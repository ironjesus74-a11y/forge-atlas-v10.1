import os
import datetime
from github import Github
from openai import OpenAI

# The Daemon operates using Groq for fast RAG processing
GITHUB_TOKEN = os.getenv("GH_PAT")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") 

if not GITHUB_TOKEN or not OPENAI_API_KEY:
    print("Daemon Error: Missing credentials.")
    exit(1)

gh = Github(GITHUB_TOKEN)
client = OpenAI(api_key=OPENAI_API_KEY, base_url="https://api.groq.com/openai/v1")
repo = gh.get_repo(os.getenv("GITHUB_REPOSITORY"))

print(f"Atlas Daemon RAG Initialized on {repo.full_name}")

def gather_real_metrics():
    """Fetches truthful, real-time stats from the repository."""
    commits = repo.get_commits().totalCount
    open_prs = repo.get_pulls(state='open').totalCount
    closed_prs = repo.get_pulls(state='closed').totalCount
    branches = repo.get_branches().totalCount
    topics = repo.get_topics()
    
    return {
        "commits": commits,
        "active_prs": open_prs,
        "resolved_prs": closed_prs,
        "branches": branches,
        "topics": topics
    }

def perform_rag_update(metrics):
    """Uses LLM to rotate topics and generate a real leaderboard."""
    try:
        current_readme = repo.get_contents("README.md")
        readme_text = current_readme.decoded_content.decode('utf-8')
        sha = current_readme.sha
    except:
        readme_text = "# Forge Atlas v10.1\n\nAI Orchestration Environment."
        sha = None

    prompt = f"""
    You are the Atlas RAG Daemon. Update the provided README.md.
    Do NOT change the core structure or UI instructions.
    
    1. Update or add a "📊 Live Ecosystem Leaderboard" section using these REAL stats:
       - Commits: {metrics['commits']}
       - PRs Resolved by AI: {metrics['resolved_prs']}
       - Active AI Branches: {metrics['branches']}
    2. Rotate the "🎯 Focus Topic of the Day" based on these current topics: {metrics['topics']}. Pick one and write 2 sentences on how the AI Swarm is optimizing it today.
    
    Return ONLY the raw updated Markdown text.
    
    CURRENT README:
    {readme_text}
    """
    
    response = client.chat.completions.create(
        model="llama3-70b-8192",
        messages=[{"role": "system", "content": prompt}],
        temperature=0.4
    )
    
    new_readme = response.choices[0].message.content
    
    # Commit the updated RAG context
    if sha:
        repo.update_file("README.md", "daemon(rag): update live leaderboard and rotate topics", new_readme, sha)
    else:
        repo.create_file("README.md", "daemon(rag): initialize leaderboard", new_readme)
    print("SUCCESS: Real metrics and RAG context committed to README.")

if __name__ == "__main__":
    metrics = gather_real_metrics()
    perform_rag_update(metrics)
