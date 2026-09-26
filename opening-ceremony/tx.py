import os,sys,json
from pathlib import Path
pref=Path(r"C:\Users\User\Documents\code\clippro\asr_env")
for c in [pref/"Lib"/"site-packages"/"nvidia"/"cublas"/"bin",pref/"Lib"/"site-packages"/"nvidia"/"cudnn"/"bin",pref/"Lib"/"site-packages"/"nvidia"/"cuda_nvrtc"/"bin"]:
    if c.exists(): os.environ["PATH"]=str(c)+";"+os.environ["PATH"]; os.add_dll_directory(str(c))
from faster_whisper import WhisperModel
m=WhisperModel("large-v3",device="cuda",compute_type="float16")
segs,_=m.transcribe(sys.argv[1],language="en",vad_filter=True,beam_size=5)
out=[]
for s in segs: out.append(f"[{s.start:6.1f}] {s.text.strip()}")
open(sys.argv[2],"w",encoding="utf-8").write("\n".join(out))
print(f"{len(out)} segments -> {sys.argv[2]}")
