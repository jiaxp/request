import Vue from 'vue'
import App from './App.vue'
// import Request from '../lib'

console.log('***********')
console.log(process.env.NODE_ENV)

new Vue({
  el: '#app',
  render: h => h(App)
})
