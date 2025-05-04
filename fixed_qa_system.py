import logging
import os
import json
from typing import List, Dict, Any
import numpy as np
import torch
from sentence_transformers import SentenceTransformer
from sentence_transformers.cross_encoder import CrossEncoder
import google.generativeai as genai
import faiss
import langdetect
import time
from unicodedata import normalize
import google.api_core.exceptions as google_exceptions
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("qa_system.log", encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("NAUSS_QA")

# Configuration
CONFIG = {
    "gemini_api_key": os.getenv("GEMINI_API_KEY", "AIzaSyD4Y49gMvQAxq9plpnp6qzbf_dyJ2Jc1ys"),
    "embedder_model": "sentence-transformers/paraphrase-multilingual-mpnet-base-v2",
    "rag_path": "./enhanced_rag_model_v6",
    "top_k": 5,
    "relevance_threshold": 0.3
}

class TextProcessor:
    @staticmethod
    def normalize(text: str) -> str:
        """Normalize text for consistent matching."""
        text = normalize('NFKC', text.strip())
        return ' '.join(text.split())

    @staticmethod
    def detect_language(text: str) -> tuple:
        try:
            lang = langdetect.detect(text)
            confidence = 1.0
        except:
            lang = 'unknown'
            confidence = 0.0
        return lang, confidence

class RAGUpdateHandler(FileSystemEventHandler):
    def __init__(self, retriever):
        self.retriever = retriever

    def on_modified(self, event):
        if not event.is_directory and event.src_path.endswith('train_squad.json'):
            logger.info(f"Detected change in {event.src_path}, rebuilding RAG index")
            self.retriever.rebuild_index()

class RAGRetriever:
    def __init__(self, index_path: str, contexts_path: str, embedder_model: str):
        try:
            self.embedder = SentenceTransformer(embedder_model, device='cuda' if torch.cuda.is_available() else 'cpu')
            self.index_path = index_path
            self.contexts_path = contexts_path
            self.embedder_model = embedder_model
            self.rebuild_index()
            # Start file monitoring
            self.observer = Observer()
            self.observer.schedule(RAGUpdateHandler(self), path=os.path.dirname(os.path.join('nauss_splits', 'train_squad.json')), recursive=False)
            self.observer.start()
        except Exception as e:
            logger.error(f"Error initializing RAGRetriever: {e}")
            raise

    def rebuild_index(self):
        try:
            self.index = faiss.IndexFlatL2(768)  # Assuming 768-dimensional embeddings
            with open(self.contexts_path, 'r', encoding='utf-8') as f:
                self.metadata = json.load(f)
            
            self.contexts = []
            self.context_languages = []
            for idx, meta in enumerate(self.metadata):
                try:
                    file_path = meta.get('file')
                    title = meta.get('title')
                    para_idx = meta.get('paragraph_idx')
                    if not all([file_path, title is not None, para_idx is not None]):
                        logger.warning(f"Invalid metadata entry at index {idx}: {meta}")
                        continue
                    if not os.path.exists(file_path):
                        logger.warning(f"SQuAD file not found: {file_path}")
                        continue
                    with open(file_path, 'r', encoding='utf-8') as f:
                        squad_data = json.load(f)
                    found = False
                    for data in squad_data.get('data', []):
                        if data.get('title') == title:
                            paragraphs = data.get('paragraphs', [])
                            if para_idx < len(paragraphs):
                                context = paragraphs[para_idx].get('context', '')
                                if context:
                                    self.contexts.append(TextProcessor.normalize(context))
                                    self.context_languages.append(TextProcessor.detect_language(context)[0])
                                    found = True
                                    break
                    if not found:
                        logger.warning(f"Context not found for metadata at index {idx}: {meta}")
                except Exception as e:
                    logger.warning(f"Error loading context for metadata at index {idx}: {meta}, Error: {e}")
            
            if not self.contexts:
                raise ValueError("No valid contexts loaded from metadata")
            
            # Encode contexts and build FAISS index
            context_embeddings = self.embedder.encode(self.contexts, convert_to_tensor=False)
            self.index.add(context_embeddings)
            faiss.write_index(self.index, self.index_path)
            logger.info(f"RAG retriever initialized with {len(self.contexts)} contexts")
        except Exception as e:
            logger.error(f"Error rebuilding RAG index: {e}")
            raise

    def search(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        try:
            query = TextProcessor.normalize(query)
            query_lang, _ = TextProcessor.detect_language(query)
            query_embedding = self.embedder.encode([query], convert_to_tensor=False)
            distances, indices = self.index.search(query_embedding, k * 2)  # Fetch more for reranking
            results = []
            for idx, dist in zip(indices[0], distances[0]):
                if idx < len(self.contexts) and query_lang in ('ar', 'en') and self.context_languages[idx] == query_lang:
                    results.append({
                        'content': self.contexts[idx],
                        'distance': float(dist),
                        'relevance': 1.0 / (1.0 + float(dist)),
                        'metadata': self.metadata[idx]
                    })
            # Rerank using cross-encoder
            if results:
                cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-12-v2', device='cuda' if torch.cuda.is_available() else 'cpu')
                pairs = [[query, result['content']] for result in results]
                scores = cross_encoder.predict(pairs)
                for result, score in zip(results, scores):
                    result['relevance'] = float(score)  # Use raw cross-encoder score
                results = sorted(results, key=lambda x: x['relevance'], reverse=True)[:k]
            return results
        except Exception as e:
            logger.error(f"Error searching RAG index: {e}")
            return []

class QuestionAnsweringSystem:
    def __init__(self):
        self.top_k = CONFIG["top_k"]
        self.relevance_threshold = CONFIG["relevance_threshold"]
        self.rag_retriever = None
        self.gemini = None
        self.cross_encoder = None

    def initialize(self) -> bool:
        logger.info("Initializing QA system...")
        try:
            # Configure Gemini API
            if not CONFIG["gemini_api_key"]:
                raise ValueError("GEMINI_API_KEY environment variable not set")
            genai.configure(api_key=CONFIG["gemini_api_key"])
            self.gemini = genai.GenerativeModel("gemini-1.5-flash")
            logger.info("Gemini API configured successfully")

            # Load RAG retriever
            logger.info("Loading RAG system...")
            self.rag_retriever = RAGRetriever(
                index_path=os.path.join(CONFIG["rag_path"], "faiss_index.bin"),
                contexts_path=os.path.join(CONFIG["rag_path"], "contexts.json"),
                embedder_model=CONFIG["embedder_model"]
            )

            # Initialize cross-encoder
            logger.info("Initializing cross-encoder...")
            self.cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-12-v2', device='cuda' if torch.cuda.is_available() else 'cpu')

            logger.info("QA system initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize QA system: {e}")
            return False

    def _correct_query(self, query: str) -> str:
        """Use Gemini to correct typos in the query."""
        try:
            query_lang = TextProcessor.detect_language(query)[0]
            prompt = f"""
            The following query may contain typos or errors. Correct the query to its proper form in {'Arabic' if query_lang == 'ar' else 'English'}, assuming it is related to Naif Arab University for Security Sciences (NAUSS). Return only the corrected query.

            Query: {query}
            """
            response = self.gemini.generate_content(prompt).text.strip()
            logger.info(f"Corrected query from '{query}' to '{response}'")
            return response
        except Exception as e:
            logger.warning(f"Error correcting query: {e}")
            return query

    def _retrieve_contexts(self, question: str) -> List[Dict[str, Any]]:
        return self.rag_retriever.search(question, k=self.top_k)

    def _fetch_new_context(self, question: str) -> Dict[str, Any]:
        """Fetch new context for unanswered questions using Gemini or external sources."""
        try:
            prompt = f"""
            Provide a concise, factual answer to the following question about Naif Arab University for Security Sciences (NAUSS) in Arabic. Return only the answer as a single paragraph suitable for adding to a knowledge base.

            Question: {question}
            """
            response = self.gemini.generate_content(prompt).text.strip()
            if response and "لا أعرف" not in response:
                return {
                    'content': response,
                    'metadata': {
                        'file': os.path.join('nauss_splits', 'train_squad.json'),
                        'title': 'Naif_Arab_University_QA',
                        'paragraph_idx': len(self.rag_retriever.contexts)
                    }
                }
            return None
        except Exception as e:
            logger.warning(f"Error fetching new context: {e}")
            return None

    def _update_rag_index(self, new_context: Dict[str, Any]):
        """Update contexts.json and FAISS index with new context."""
        try:
            # Append to contexts.json
            contexts_path = os.path.join(CONFIG['rag_path'], 'contexts.json')
            with open(contexts_path, 'r', encoding='utf-8') as f:
                contexts_data = json.load(f)
            contexts_data.append(new_context['metadata'])
            with open(contexts_path, 'w', encoding='utf-8') as f:
                json.dump(contexts_data, f, ensure_ascii=False, indent=2)

            # Append to train_squad.json
            squad_file = new_context['metadata']['file']
            with open(squad_file, 'r', encoding='utf-8') as f:
                squad_data = json.load(f)
            new_paragraph = {
                'context': new_context['content'],
                'qas': [{
                    'question': question,
                    'id': f"qa_{new_context['metadata']['paragraph_idx']}",
                    'answers': [{'text': new_context['content'], 'answer_start': 0}]
                }]
            }
            for data in squad_data['data']:
                if data['title'] == new_context['metadata']['title']:
                    data['paragraphs'].append(new_paragraph)
                    break
            with open(squad_file, 'w', encoding='utf-8') as f:
                json.dump(squad_data, f, ensure_ascii=False, indent=2)

            # Rebuild FAISS index
            self.rag_retriever.rebuild_index()
            logger.info("RAG index updated with new context")
        except Exception as e:
            logger.error(f"Error updating RAG index: {e}")

    def _generate_answer_with_gemini(self, question: str, contexts: List[Dict[str, Any]], is_corrected: bool = False) -> Dict[str, Any]:
        max_retries = 3
        for attempt in range(max_retries):
            try:
                contexts_str = "\n".join([f"{i+1}. {ctx['content']} (Relevance: {ctx['relevance']:.3f})" for i, ctx in enumerate(contexts)]) if contexts else "No contexts provided."
                query_lang = TextProcessor.detect_language(question)[0]
                prompt = f"""
                You are an expert on Naif Arab University for Security Sciences (NAUSS). Answer the following question in {'Arabic' if query_lang == 'ar' else 'English'} based on the provided information. Write the answer in a natural, human-like style, as if responding directly to a student or visitor, without mentioning 'texts,' 'contexts,' or technical processes. If the information is insufficient, state that clearly, suggest contacting NAUSS administration (http://www.nauss.edu.sa/), and ask for more details to clarify the query.

                Question: {question}
                Information:
                {contexts_str}

                Instructions:
                - Provide a concise, accurate, and NAUSS-specific answer.
                - Answer in {'Arabic' if query_lang == 'ar' else 'English'}.
                - If information is missing, include a follow-up question like 'هل يمكنك توضيح المزيد؟' or 'Can you clarify further?'.
                - Avoid technical terms or references to data sources.
                """
                response = self.gemini.generate_content(prompt).text.strip()

                if not response or "I don't know" in response.lower() or "لا أعرف" in response:
                    if not is_corrected and query_lang == 'ar':
                        # Correct the query and retry
                        corrected_query = self._correct_query(question)
                        if corrected_query != question:
                            logger.info(f"Retrying with corrected query: {corrected_query}")
                            new_contexts = self._retrieve_contexts(corrected_query)
                            return self._generate_answer_with_gemini(corrected_query, new_contexts, is_corrected=True)
                    # No answer found, attempt to fetch and update
                    logger.warning("No answer found, attempting to fetch new information")
                    new_context = self._fetch_new_context(question)
                    if new_context:
                        self._update_rag_index(new_context)
                        new_contexts = self._retrieve_contexts(question)
                        return self._generate_answer_with_gemini(question, new_contexts, is_corrected=True)
                    return {
                        'answer': f"لا توجد معلومات كافية للإجابة على سؤالك. يرجى التواصل مع إدارة جامعة نايف على http://www.nauss.edu.sa/ للحصول على التفاصيل. هل يمكنك توضيح المزيد؟" if query_lang == 'ar' else f"There’s not enough information to answer your question. Please contact NAUSS administration at http://www.nauss.edu.sa/ for details. Can you clarify further?",
                        'confidence': 0.3,
                        'language': query_lang,
                       
                        'contexts': [ctx['content'] for ctx in contexts]
                    }

                lang, lang_conf = TextProcessor.detect_language(response)
                confidence = 0.7 if lang == query_lang else 0.5

                # Boost confidence if answer aligns with contexts
                for ctx in contexts:
                    normalized_ctx = TextProcessor.normalize(ctx['content'].lower())
                    normalized_answer = TextProcessor.normalize(response.lower())
                    if normalized_answer in normalized_ctx:
                        confidence += 0.2
                        break

                return {
                    'answer': response,
                    'confidence': min(confidence, 1.0),
                    'language': lang,
                    
                    'contexts': [ctx['content'] for ctx in contexts]
                }
            except google_exceptions.ResourceExhausted as e:
                if attempt < max_retries - 1:
                    retry_delay = 2 ** attempt
                    logger.warning(f"Rate limit hit, retrying in {retry_delay}s: {e}")
                    time.sleep(retry_delay)
                else:
                    logger.error(f"Max retries reached: {e}")
                    return {
                        'answer': 'خطأ في معالجة الطلب. يرجى المحاولة لاحقًا.' if query_lang == 'ar' else 'Error processing request. Please try again later.',
                        'confidence': 0.0,
                        'language': query_lang,
                      
                        'contexts': [ctx['content'] for ctx in contexts]
                    }
            except Exception as e:
                logger.warning(f"Error generating answer with Gemini: {e}")
                return {
                    'answer': 'خطأ في معالجة الطلب. يرجى المحاولة لاحقًا.' if query_lang == 'ar' else 'Error processing request. Please try again later.',
                    'confidence': 0.0,
                    'language': query_lang,
                    
                    'contexts': [ctx['content'] for ctx in contexts]
                }

    def _calculate_relevance(self, question: str, answer: str) -> float:
        if not answer:
            return 0.0
        try:
            qa_pair = [[question, answer]]
            score = self.cross_encoder.predict(qa_pair)[0]
            return float(np.clip(score, 0, 1))
        except Exception as e:
            logger.warning(f"Error calculating relevance: {e}")
            return 0.0

    def answer_question_rag_gemini(self, question: str) -> Dict[str, Any]:
        question = TextProcessor.normalize(question)
        contexts = self._retrieve_contexts(question)
        query_lang = TextProcessor.detect_language(question)[0]
        logger.info(f"Top {len(contexts)} contexts retrieved for query: {question}")
        for i, ctx in enumerate(contexts, 1):
            logger.info(f"Context {i}: {ctx['content']} (Relevance: {ctx['relevance']:.3f}, Distance: {ctx['distance']:.3f}, Metadata: {ctx['metadata']})")

        if not contexts or all(ctx['relevance'] < self.relevance_threshold for ctx in contexts):
            logger.warning("No relevant contexts found, falling back to Gemini")
            answer_data = self._generate_answer_with_gemini(question, contexts)
            answer_data['follow_up_question'] = 'هل يمكنك توضيح المزيد؟' if query_lang == 'ar' else 'Can you clarify further?'
            answer_data['retrieved_contexts'] = [
                {'content': ctx['content'], 'relevance': ctx['relevance'], 'distance': ctx['distance'], 'metadata': ctx['metadata']}
                for ctx in contexts
            ]
            return answer_data

        answer_data = self._generate_answer_with_gemini(question, contexts)
        answer_data['follow_up_question'] = 'هل تريد معرفة المزيد عن هذا الموضوع؟' if query_lang == 'ar' else 'Would you like to know more about this topic?'
        relevance = self._calculate_relevance(question, answer_data['answer'])
        answer_data['confidence'] = min(answer_data['confidence'], relevance)
        answer_data['retrieved_contexts'] = [
            {'content': ctx['content'], 'relevance': ctx['relevance'], 'distance': ctx['distance'], 'metadata': ctx['metadata']}
            for ctx in contexts
        ]
        return answer_data

if __name__ == "__main__":
    qa_system = QuestionAnsweringSystem()
    if qa_system.initialize():
        result = qa_system.answer_question_rag_gemini("من هو ريس جامعة نايف الحالي؟")
        print(json.dumps(result, ensure_ascii=False, indent=2))