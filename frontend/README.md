# TradeSmartly Frontend

## Development

### Install packages

```bash
npm install
```

### Start development server

```bash
npm run dev
```

## Deploy to AWS EC2

### First deployment

- Step1: Install Git (>= 2.34)
- Step2: Generate a SSH key pair and store the public key in GitHub.
- Step3: Clone the repository from GitHub.

  ```bash
  # Under the `~` directory
  git clone --branch build git@github.com:trade-smartly/trade-smartly-frontend.git
  ```

- ⭐️ Step4: Copy the project to `/var/www/html/`

    ```bash
    sudo cp -R ~/trade-smartly-frontend/ /var/www/html/
    ```

- Step5: Nginx
  - Step5-1: Install Nginx
  - Step5-2: Create a server block configuration file at `/etc/nginx/sites-available/`
    - File name: `trade_smartly`
    - Add the following content:

        ```nginx
        root /var/www/html/trade-smartly-frontend;
        location / {
            try_files $uri /index.html;
        }
        ```

  - Step5-3: Remove the default link in `/etc/nginx/sites-enable/` and add a link to `trade_smartly` (the file name of the configuration file created in step5-2)
  - Step5-4: Test config files

    ```bash
    sudo nginx -t
    ```

  - Step5-5: Start Nginx server

    ```bash
    systemctl start nginx
    # or
    service nginx start
    ```

### CI/CD flow and common commands

>`master` branch is the development branch; `build` branch is where the built code is placed, and the built code is served directly to the production environment (in principle, `build` branch does not exist locally).

- **Build at local and push to GitHub**
  - You can use the shortcut command:

    ```bash
    bash ./build-and-push.sh
    # or
    npm run build-and-push
    ```

- **SSH into EC2 instance**

  ```bash
  ssh trade.smartly.aws.ec2
  ```

  Note: You should have the following content in the SSH config file: `~/.ssh/config` to connect to the EC2 instance:

  ```plaintext
  Host trade.smartly.aws.ec2
    HostName ec2-13-215-190-116.ap-southeast-1.compute.amazonaws.com
    User ubuntu
    ForwardAgent yes
    IdentityFile {PATH/TO/PRIVATE_KEY}
    AddKeysToAgent yes
  ```

- **(On EC2) Pull the latest `build` branch from GitHub**

  Because local always creates a new orphan branch and force pushes, it will be considered a divergent branch when pulling directly, so we must do this:

  ```bash
  # On EC2
  cd ~/trade-smartly-frontend
  git fetch origin build
  git branch -D previous_build
  git branch -m build previous_build
  git checkout -b build FETCH_HEAD
  ```

  Keep the previous version in the `previous_build` branch, so you can check it out if the new version has issues.

- **(On EC2) Replace the `trade-smartly-frontend/` directory under `/var/www/html/` with the new one**

  ```bash
  # On EC2
  sudo rsync -a --delete ~/trade-smartly-frontend/ /var/www/html/trade-smartly-frontend/
  ```
