"""Upload the trained model to a PRIVATE Hugging Face repo, retrying (this PC's link to huggingface.co drops sometimes)."""
import time
from huggingface_hub import HfApi
api = HfApi(); repo = "chinchop/farmhand-laya"
for attempt in range(1, 7):
    try:
        api.create_repo(repo, private=True, exist_ok=True, repo_type="model")
        info = api.upload_folder(folder_path="model/farmhand-laya", repo_id=repo, commit_message="Farm Hand Laya: fine-tuned irrigation decider")
        print("uploaded:", info)
        break
    except Exception as e:
        print(f"attempt {attempt} failed: {type(e).__name__}: {str(e)[:150]}"); time.sleep(5 * attempt)
files = api.list_repo_files(repo); print("files on hub:", files)
print("private:", api.model_info(repo).private)
