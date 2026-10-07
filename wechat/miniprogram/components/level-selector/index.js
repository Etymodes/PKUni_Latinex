const { levelCards } = require('../../lib/copy');

Component({
  options: { styleIsolation: 'isolated' },
  properties: {
    value: { type: String, value: 'C' },
    locale: { type: String, value: 'zh-CN' },
    disabled: { type: Boolean, value: false },
  },
  data: { items: [], selected: null, caption: '' },
  observers: {
    'value, locale': function () { this.updateLabels(); },
  },
  lifetimes: {
    attached() { this.updateLabels(); },
  },
  methods: {
    updateLabels() {
      const items = levelCards(this.properties.locale);
      this.setData({
        items,
        selected: items.find(item => item.id === this.properties.value) || items[0],
        caption: this.properties.locale === 'en' ? 'Learning level' : '学习等级',
      });
    },
    choose(event) {
      const level = event.currentTarget.dataset.level;
      if (this.properties.disabled || level === this.properties.value || !this.data.items.some(item => item.id === level)) return;
      this.triggerEvent('change', { level });
    },
  },
});
