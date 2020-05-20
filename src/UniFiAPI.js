const axios = require('axios');
const https = require('https');
const axiosCookieJar = require('./axios-cookie-jar');

module.exports = class UniFiAPI {
  constructor(options, log) {
    this.log = log;

    this.url = options.url;
    this.username = options.username;
    this.password = options.password;

    // Set up local axios instance
    this.axios = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });
    axiosCookieJar(this.axios);
  }

  async request(method, url, data = null) {
    try {
      return await this._performRequest(method, url, data);
    } catch (e) {
      this.log.error('Error, logging in and trying again');

      // Log in and try again
      await this.login();
      return this._performRequest(method, url, data);
    }
  }

  async _performRequest(method, url, data = null) {
    const config = {
      method,
      url,
      data,
      baseURL: this.url,
    };

    this.log.debug(`Performing request: ${method} ${url}`);
    this.log.debug(`Request config: ${JSON.stringify(config)}`);

    const result = await this.axios(config);

    this.log.debug(`Response: ${JSON.stringify(result.data)}`);

    return result.data;
  }

  async login() {
    await this._performRequest('POST', 'api/login', {
      username: this.username,
      password: this.password,
    });

    this.log.info('Successfully logged into UniFi controller');
  }

  getSites() {
    return this.request('GET', 'api/self/sites');
  }

  getDevices(site) {
    return this.request('GET', `api/s/${site}/stat/device`);
  }

  setDevice(site, deviceId, data) {
    return this.request('PUT', `api/s/${site}/rest/device/${deviceId}`, data);
  }
};
