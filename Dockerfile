FROM denoland/deno:2.2.0

RUN apt-get update && apt-get install -y wget gnupg \
    && wget -q https://dl-ssl.google.com/linux/linux_signing_key.pub -O /tmp/google-chrome-key.pub \
    && gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg /tmp/google-chrome-key.pub \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] https://dl-ssl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
    && apt-get update -y \
    && apt-get install -y xz-utils \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-kacst fonts-freefont-ttf libxss1 dbus dbus-x11 --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/google-chrome-key.pub

RUN which google-chrome-stable || true

WORKDIR /tmp
RUN wget https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-amd64-static.tar.xz \
    && tar xvf ffmpeg-git-amd64-static.tar.xz \
    && mv ffmpeg-git-*-static/ffmpeg /usr/local/bin/ffmpeg \
    && mv ffmpeg-git-*-static/ffprobe /usr/local/bin/ffprobe \
    && rm -rf ffmpeg-git-*-static ffmpeg-git-amd64-static.tar.xz

WORKDIR /app
COPY deno.json deno.json
COPY src ./src

RUN deno install

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV WLGUL_DOCKER=true

ENTRYPOINT ["deno", "task", "start"]