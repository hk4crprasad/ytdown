from pytubefix import YouTube

url = "https://youtu.be/ReZbk5ES06Y?si=mX1s_CcgzL0unlUR4"

yt = YouTube(url, token_file="./tockens.json")
ys = yt.streams.get_highest_resolution()
ys.download()
