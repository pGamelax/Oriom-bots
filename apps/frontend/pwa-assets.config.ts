import { defineConfig, minimalPreset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...minimalPreset,
    apple: {
      sizes: [180],
      padding: 0.15,
      resizeOptions: { background: '#c1341a' },
    },
    maskable: {
      sizes: [512],
      padding: 0.25,
      resizeOptions: { background: '#c1341a' },
    },
    transparent: {
      sizes: [64, 192, 512],
      padding: 0.05,
      resizeOptions: { background: 'transparent' },
    },
  },
  images: ['public/oriom-bot-favicon.svg'],
})
