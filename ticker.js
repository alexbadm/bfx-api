const BFX = require('bitfinex-api-node')

const API_KEY = 'XlyaMnQuRY9ao7EKuTHFvlwX999Wk9FWoPZQ8fGv1Vq'
const API_SECRET = '4K0zUKaElRvNwIuSf9lNkUPN2WOLOUAVR99gg3Xu5Ga'

const opts = {
  version: 2,
  transform: true
}

const bws = new BFX(API_KEY, API_SECRET, opts).ws

bws.on('auth', (a) => {
  console.log('authenticated', a)
  // bws.submitOrder ...
})

bws.on('error', console.error)

bws.on('open', () => {
  // bws.subscribeTicker('IOTBTC')
  // bws.subscribeOrderBook('IOTBTC')
  bws.subscribeTrades('IOTBTC')
  bws.subscribeTrades('BTCUSD')

  // authenticate
  bws.auth()
})

bws.on('orderbook', (pair, book) => {
  console.log(pair, ' Order book:', book)
})

bws.on('trade', (pair, trade) => {
  console.log(`Trade [${pair}]:`, trade)
})

bws.on('ticker', (pair, ticker) => {
  console.log('Ticker:', ticker)
})

bws.on('subscribed', res => {
  console.log('subscribed', res)
})
