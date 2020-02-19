ARG IMAGE=amd64/debian:stretch-slim

FROM $IMAGE as builder

MAINTAINER dispatch <admin@bitwave.tv>

ENV SRC="/usr/local/" \
    LD_LIBRARY_PATH="/usr/local/lib" \
    PKG_CONFIG_PATH="/usr/local/lib/pkgconfig"

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
#
# ARG X264_VERSION=20190409-2245-stable
# curl -OL "http://ftp.videolan.org/pub/videolan/x264/snapshots/x264-snapshot-${X264_VERSION}.tar.bz2" && \
# tar -xvj -f x264-snapshot-${X264_VERSION}.tar.bz2 && \
# cd x264-snapshot-${X264_VERSION} && \
#
# https://code.videolan.org/videolan/x264/-/archive/stable/x264-stable.tar.bz2
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
ARG X265_VERSION=3.2.1

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
ARG FFMPEG_VERSION=4.2.2

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
ARG NODE_VERSION=10.17.0

RUN mkdir -p /dist && cd /dist && \
    curl -OL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" && \
    tar -xvJ -f "node-v${NODE_VERSION}-linux-x64.tar.xz" && \
    cd node-v${NODE_VERSION}-linux-x64 && \
    cp -R bin /usr/local && \
    cp -R lib /usr/local


#ARG NGINX_RTMP_VERSION_OVERRIDE=2.0.0
#ARG NGINX_RTMP_REPO=bitwave-tv
#ARG NGINX_RTMP_VERSION=2.0.2
#
# nginx-rtmp
#RUN mkdir -p /dist && cd /dist && \
#    curl -OL "https://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz" && \
#    tar -xvz -f "nginx-${NGINX_VERSION}.tar.gz" && \
#    curl -OL "https://github.com/${NGINX_RTMP_REPO}/nginx-rtmp-module/archive/v${NGINX_RTMP_VERSION_OVERRIDE}.tar.gz" && \
#    tar -xvz -f "v${NGINX_RTMP_VERSION_OVERRIDE}.tar.gz" && \
#    cd nginx-${NGINX_VERSION} && \
#    ./configure \
#        --prefix=/usr/local/nginx \
#        --with-select_module \
#        --with-poll_module \
#        --with-threads \
#        --with-file-aio \
#        --with-http_ssl_module \
#        --with-http_v2_module \
#        --with-http_realip_module \
#        --with-http_xslt_module=dynamic \
#        --with-http_dav_module \
#        --with-http_flv_module \
#        --with-http_mp4_module \
#        --with-http_gunzip_module \
#        --with-http_gzip_static_module \
#        --with-http_auth_request_module \
#        --with-http_random_index_module \
#        --with-http_secure_link_module \
#        --with-http_degradation_module \
#        --with-http_slice_module \
#        --with-http_stub_status_module \
#        --with-stream=dynamic \
#        --with-stream_ssl_module \
#        --with-stream_realip_module \
#        --with-compat \
#        --add-module=/dist/nginx-rtmp-module-${NGINX_RTMP_VERSION_OVERRIDE} \
#        --with-debug && \
#    make -j$(nproc) && \
#    make install


ARG NGINX_VERSION=1.16.1
ARG NGINXRTMP_VERSION=1.2.1

# nginx-rtmp
RUN mkdir -p /dist && cd /dist && \
    curl -OL "https://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz" && \
    tar -xvz -f "nginx-${NGINX_VERSION}.tar.gz" && \
    curl -OL "https://github.com/arut/nginx-rtmp-module/archive/v${NGINXRTMP_VERSION}.tar.gz" && \
    tar -xvz -f "v${NGINXRTMP_VERSION}.tar.gz" && \
    cd nginx-${NGINX_VERSION} && \
    ./configure \
        --prefix=/usr/local/nginx \
        --with-http_ssl_module \
        --with-http_v2_module \
        --add-module=/dist/nginx-rtmp-module-${NGINXRTMP_VERSION} && \
    make -j$(nproc) && \
    make install
