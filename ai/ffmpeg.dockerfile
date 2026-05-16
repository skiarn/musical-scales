# Dockerfile
# docker build -t ubuntu-ffmpeg -f ffmpeg.dockerfile .
# docker run -v "pwd":/home/ubuntu -it ubuntu-ffmpeg
# ffmpeg -i /home/ubuntu/input.m4a /home/ubuntu/output.wav

FROM ubuntu:latest

RUN apt-get update && apt-get install -y ffmpeg

CMD ["sh"]