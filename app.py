import os
import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI()

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Define constants
PRIVATE_SPACE_URL = "https://asimabdulkhaleq-unismartagentapi.hf.space"
PUBLIC_CLIENT_URL = "https://asimabdulkhaleq-aiuniversityagent.hf.space"  # Your public client URL
HF_API_TOKEN = os.environ.get("UniAPI")  # Token from environment variable

# Configure CORS to allow requests from the public client itself (frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[PUBLIC_CLIENT_URL,PRIVATE_SPACE_URL],  # Allow frontend hosted on this client
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (e.g., JS, CSS) and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Serve index.html
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    try:
        return templates.TemplateResponse("index.html", {"request": request})
    except Exception as e:
        logger.error(f"Error serving index.html: {str(e)}")
        raise HTTPException(status_code=500, detail="Error loading page")

# Token endpoint (secured minimally for demo purposes)
@app.get("/api/gettoken")
async def get_token():
    """
    Returns the HF_API_TOKEN from the environment variable UniAPI.
    In production, secure this with authentication (e.g., OAuth2).
    """
    try:
        if not HF_API_TOKEN:
            logger.error("HF_API_TOKEN not found in environment variables")
            raise HTTPException(status_code=500, detail="Server configuration error: Token not available")
        return {"token": HF_API_TOKEN}
    except Exception as e:
        logger.error(f"Error in /api/gettoken: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving token: {str(e)}")

# Optional: Proxy endpoint to private server (example)
@app.get("/api/proxy/{path:path}")
async def proxy_to_private_server(path: str, request: Request):
    import requests  # Local import to avoid unused import warning
    try:
        headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
        response = requests.get(f"{PRIVATE_SPACE_URL}/api/{path}", headers=headers, params=request.query_params)
        response.raise_for_status()
        return JSONResponse(content=response.json())
    except requests.RequestException as e:
        logger.error(f"Proxy error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error proxying request: {str(e)}")
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)