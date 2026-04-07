import pino from 'pino'

const logger = pino({
  messageKey: 'message',
  formatters: {
    level(label) {
      return { severity: label.toUpperCase() }
    },
  },
})

export default logger

