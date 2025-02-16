FROM denoland/deno:2.1.10

RUN apt-get update && apt-get install -y wget gnupg
RUN wget -q -O /tmp/google-chrome-key.pub https://dl-ssl.google.com/linux/linux_signing_key.pub
RUN gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg /tmp/google-chrome-key.pub
RUN echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] https://dl-ssl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-khmeros fonts-kacst fonts-freefont-ttf libxss1 dbus dbus-x11 --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*
    # && groupadd -r apify && useradd -rm -g apify -G audio,video apify

RUN which google-chrome-stable || true

WORKDIR /app
COPY deno.json deno.json
COPY src ./src

RUN deno install

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV WLGUL_DOCKER=true

ENTRYPOINT ["deno", "task", "start"]