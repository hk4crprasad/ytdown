from pytubefix import YouTube

url = "https://youtu.be/ReZbk5ES06Y?si=mX1s_CcgzL0unlUR4"

yt = YouTube(url, use_oauth=True)
ys = yt.streams.get_highest_resolution()
ys.download()
