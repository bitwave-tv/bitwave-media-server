ARG IMAGE=amd64/debian:stretch-slim

FROM $IMAGE as builder

MAINTAINER dispatch <admin@bitwave.tv>

# setup envvironment variables
ENV SRC="/usr/local/" \
    LD_LIBRARY_PATH="/usr/local/lib" \
    PKG_CONFIG_PATH="/usr/local/lib/pkgconfig"

# update repos & install build tools
RUN apt-get update && \
    apt-get install -y \
        # libraries
        libass-dev \
        libfreetype6-dev \
        libvorbis-dev \
        libpcre3-dev \
        libtool \
        libssl-dev \
        zlib1g-dev \
        libasound2-dev \
        libxml2-dev \
        libxslt-dev \
        libgd-dev \
        libgeoip-dev \
        libperl-dev \
        # etc
        pkg-config \
        curl \
        texinfo \
        autoconf \
        automake \
        build-essential \
        cmake


# nasm
ARG NASM_VERSION=2.14.02
RUN mkdir -p /dist && cd /dist && \
    curl -OL "https://www.nasm.us/pub/nasm/releasebuilds/${NASM_VERSION}/nasm-${NASM_VERSION}.tar.xz" && \
    tar -xvJ -f nasm-${NASM_VERSION}.tar.xz && \
    cd nasm-${NASM_VERSION} && \
    ./configure && \
    make -j$(nproc) && \
    make install


# x264
ARG X264_VERSION=20190409-2245-stable
RUN mkdir -p /dist && cd /dist && \
    curl -OL "https://code.videolan.org/videolan/x264/-/archive/stable/x264-stable.tar.bz2" && \
    tar -xvj -f x264-stable.tar.bz2 && \
    cd x264-stable && \
    ./configure \
        --prefix="${SRC}" \
        --bindir="${SRC}/bin" \
        --enable-shared && \
    make -j$(nproc) && \
    make install


# x265
ARG X265_VERSION=3.0
RUN mkdir -p /dist && cd /dist && \
    curl -OL "http://ftp.videolan.org/pub/videolan/x265/x265_${X265_VERSION}.tar.gz" && \
    tar -xvz -f x265_${X265_VERSION}.tar.gz && \
    cd x265_${X265_VERSION}/build && \
    cmake ../source && \
    make -j$(nproc) && \
    make install


# libmp3lame
ARG LAME_VERSION=3.100
RUN mkdir -p /dist && cd /dist && \
    curl -OL "https://downloads.sourceforge.net/project/lame/lame/${LAME_VERSION}/lame-${LAME_VERSION}.tar.gz" && \
    tar -xvz -f lame-${LAME_VERSION}.tar.gz && \
    cd lame-${LAME_VERSION} && \
    ./configure \
        --prefix="${SRC}" \
        --bindir="${SRC}/bin" \
        --disable-static \
        --enable-nasm && \
    make -j$(nproc) && \
    make install


# ffmpeg && patch
ARG FFMPEG_VERSION=4.3
COPY ./contrib/ffmpeg /dist/bitwave-media-server/contrib/ffmpeg
RUN mkdir -p /dist && cd /dist && \
    curl -OL "https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.gz" && \
    tar -xvz -f ffmpeg-${FFMPEG_VERSION}.tar.gz && \
    cd ffmpeg-${FFMPEG_VERSION} && \
    patch -p1 < /dist/bitwave-media-server/contrib/ffmpeg/bitrate.patch && \
    ./configure \
        --bindir="${SRC}/bin" \
        --extra-cflags="-I${SRC}/include" \
        --extra-ldflags="-L${SRC}/lib" \
        --prefix="${SRC}" \
        --enable-nonfree \
        --enable-gpl \
        --enable-version3 \
        --enable-libmp3lame \
        --enable-libx264 \
        --enable-libx265 \
        --enable-openssl \
        --enable-postproc \
        --enable-small \
        --enable-static \
        --disable-debug \
        --disable-doc \
        --disable-shared && \
    make -j$(nproc) && \
    make install


# node.js
ARG NODE_VERSION=12.18.2
RUN mkdir -p /dist && cd /dist && \
    curl -OL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" && \
    tar -xvJ -f "node-v${NODE_VERSION}-linux-x64.tar.xz" && \
    cd node-v${NODE_VERSION}-linux-x64 && \
    cp -R bin /usr/local && \
    cp -R lib /usr/local


# nginx-rtmp
# ARG NGINX_RTMP_REPO=arut
# ARG NGINXRTMP_VERSION=1.1.7.10
# curl -OL "https://github.com/${NGINX_RTMP_REPO}}/nginx-rtmp-module/archive/v${NGINXRTMP_VERSION}.tar.gz" && \
# tar -xvz -f "v${NGINXRTMP_VERSION}.tar.gz" && \

ARG NGINX_VERSION=1.18.0
ARG NGINX_RTMP_REPO=sergey-dryabzhinsky

RUN mkdir -p /dist && cd /dist && \
    curl -OL "https://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz" && \
    tar -xvz -f "nginx-${NGINX_VERSION}.tar.gz" && \
    curl -OL "https://github.com/${NGINX_RTMP_REPO}/nginx-rtmp-module/archive/dev.tar.gz" && \
    tar -xvz -f "dev.tar.gz" && \
    cd nginx-${NGINX_VERSION} && \
    ./configure \
        --prefix=/usr/local/nginx \
        --with-http_ssl_module \
        --with-http_v2_module \
        --add-module=/dist/nginx-rtmp-module-dev && \
    make -j$(nproc) && \
    make install
