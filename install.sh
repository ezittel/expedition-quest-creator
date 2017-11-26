#!/bin/bash

apt-get update

apt-get install -y git nodejs tmux npm bash build-essential curl libfontconfig1

# Install nvm with node and npm
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.29.0/install.sh | bash

. /root/.nvm/nvm.sh && nvm install v8.1.4 && nvm alias default v8.1.4 && nvm use default && npm config set user 0 && npm config set unsafe-perm true && npm install -g webpack && ln -s /usr/bin/nodejs /usr/bin/node

