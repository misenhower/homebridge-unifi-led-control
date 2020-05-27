const { Service, Characteristic } = require('./types');
const { debounce } = require('lodash');
const convert = require('color-convert');

module.exports = class UniFiDevice {
  constructor(plugin, homeKitAccessory) {
    this.plugin = plugin;
    this.homeKitAccessory = homeKitAccessory;

    this.changePending = false;
    this._debouncedSetAllProperties = debounce(this._setAllProperties, 1000);

    this._hookCharacteristics();
  }

  _hookCharacteristics() {
    this.getCharacteristic(Characteristic.On).on('set', this.set.bind(this));

    if (this.supportsLedRing) {
      this.getCharacteristic(Characteristic.Brightness).on('set', this.set.bind(this));
      this.getCharacteristic(Characteristic.Hue).on('set', this.set.bind(this));
      this.getCharacteristic(Characteristic.Saturation).on('set', this.set.bind(this));
    }
  }

  get site() {
    return this.homeKitAccessory.context.site;
  }

  get mac() {
    return this.homeKitAccessory.context.mac;
  }

  get device_id() {
    return this.homeKitAccessory.context.device_id;
  }

  get hw_caps() {
    return this.homeKitAccessory.context.hw_caps;
  }

  get supportsLedRing() {
    return !!(this.hw_caps & (1 << 1));
  }

  matches(device) {
    return this.mac === device.mac;
  }

  async update(site, device) {
    this.homeKitAccessory.context = {
      site,
      mac: device.mac,
      device_id: device.device_id,
      hw_caps: device.hw_caps,
    };

    this.homeKitAccessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Name, device.name || device.model)
      .setCharacteristic(Characteristic.Manufacturer, 'Ubiquiti')
      .setCharacteristic(Characteristic.Model, device.model)
      .setCharacteristic(Characteristic.SerialNumber, device.mac);

    if (!this.changePending) {
      this.getCharacteristic(Characteristic.On).updateValue(device.led_override !== 'off');

      if (this.supportsLedRing) {
        this.getCharacteristic(Characteristic.Brightness).updateValue(device.led_override_color_brightness);

        let hsv = convert.hex.hsv(device.led_override_color);
        this.getCharacteristic(Characteristic.Hue).updateValue(hsv[0]);
        this.getCharacteristic(Characteristic.Saturation).updateValue(hsv[1]);
      }
    }
  }

  getService() {
    let service = this.homeKitAccessory.getService(Service.Lightbulb);

    if (!service) {
      service = this.homeKitAccessory.addService(Service.Lightbulb);
    }

    return service;
  }

  getCharacteristic(characteristic) {
    return this.getService().getCharacteristic(characteristic);
  }

  _setAllProperties() {
    this.plugin.log.error('setting properties now');

    let properties = {
      led_override: this.getCharacteristic(Characteristic.On).value ? 'on' : 'off',
    };

    if (this.supportsLedRing) {
      properties.led_override_color_brightness = this.getCharacteristic(Characteristic.Brightness).value;

      let h = this.getCharacteristic(Characteristic.Hue).value;
      let s = this.getCharacteristic(Characteristic.Saturation).value;
      let hex = convert.hsv.hex([h, s, 100]);
      properties.led_override_color = `#${hex}`;
    }

    this.changePending = false;

    return this.setProperties(properties);
  }

  async setProperties(properties) {
    this.plugin.log.info(`Device ${this.device_id}: Setting properties: ${JSON.stringify(properties)}`);

    try {
      await this.plugin.client.setDevice(this.site.name, this.device_id, properties);
    } catch (e) {
      this.plugin.log.error(e);
      this.plugin.log.error(e.response.data);
    }
  }

  set(value, callback) {
    this.changePending = true;
    this._debouncedSetAllProperties();
    callback();
  }
};
