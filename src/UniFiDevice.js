const { Service, Characteristic } = require('./types');

module.exports = class UniFiDevice {
  constructor(plugin, homeKitAccessory) {
    this.plugin = plugin;
    this.homeKitAccessory = homeKitAccessory;

    this.getOnCharacteristic().on('set', this.set.bind(this));
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

  matches(device) {
    return this.mac === device.mac;
  }

  async update(site, device) {
    this.homeKitAccessory.context = {
      site,
      mac: device.mac,
      device_id: device.device_id,
    };

    this.homeKitAccessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Name, device.name || device.model)
      .setCharacteristic(Characteristic.Manufacturer, 'Ubiquiti')
      .setCharacteristic(Characteristic.Model, device.model)
      .setCharacteristic(Characteristic.SerialNumber, device.mac);

    this.getOnCharacteristic().updateValue(device.led_override !== 'off');
  }

  getService() {
    let service = this.homeKitAccessory.getService(Service.Lightbulb);

    if (!service) {
      service = this.homeKitAccessory.addService(Service.Lightbulb);
    }

    return service;
  }

  getOnCharacteristic() {
    return this.getService().getCharacteristic(Characteristic.On);
  }

  async set(value, callback) {
    try {
      const led_override = value ? 'on' : 'off';

      this.plugin.log.info(`Device ${this.device_id}: Setting led_override to ${led_override}`);
      await this.plugin.client.setDevice('default', this.device_id, { led_override });

      callback();
    } catch (e) {
      this.plugin.log.error(e);
      this.plugin.log.error(e.response.data);
      callback(e);
    }
  }
};
