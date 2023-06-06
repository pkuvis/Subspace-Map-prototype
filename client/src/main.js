// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import App from './App'
import router from './router'
import 'jquery'

Vue.config.productionTip = false
import api from './api/index.js'
Vue.prototype.$api = api

var buildCodes = false
import $ from 'jquery'
window.$ = $

// buildCodes = true

{
  window.CommunicateWithServer = function(type, paramsObj, url, callback) {
    if (buildCodes) {
      paramsObj = JSON.stringify(paramsObj)
      $.ajax({
        type: type,
        url: url,
        data: { params: paramsObj },
        dataType: 'json',
        success: function(data) {
          callback(data)
        },
        error: function(err) {
          callback(err)
        }
      })
    } else {
      let formData = new URLSearchParams()
      formData.append('params', JSON.stringify(paramsObj))
      if (type == 'get') {
        api.get(
          url,
          formData,
          data => {
            callback(data)
          },
          error => {
            callback(error)
          }
        )
      } else if (type == 'post') {
        api.post(
          url,
          formData,
          data => {
            callback(data)
          },
          error => {
            callback(error)
          }
        )
      }
    }
  }
}

// import Vuetify from 'vuetify'
// import 'vuetify/dist/vuetify.min.css'
// Vue.use(Vuetify)

import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
Vue.use(ElementUI)

import 'font-awesome.css'
// import { library } from '@fortawesome/fontawesome-svg-core'
// import { faUpload, faWindowRestore } from '@fortawesome/free-solid-svg-icons'
// import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

// library.add(faUpload)
// Vue.component('font-awesome-icon', FontAwesomeIcon)

import BootstrapVue from 'bootstrap-vue'
Vue.use(BootstrapVue)
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'

Vue.config.productionTip = false
import * as d3 from 'd3'
window.d3 = d3
import * as hexbin from 'd3-hexbin'
Object.assign(d3, hexbin)

window.Data = null

window.ratio2percent = function(ratio) {
  return ratio * 100 + '%'
}
window.ratio2px = function(ratio, size) {
  return ratio * size
}

window.toPX = require('to-px')

// Remove item from array by value
Array.prototype.remove = function() {
  let what,
    a = arguments,
    L = a.length,
    ax
  while (L && this.length) {
    what = a[--L]
    while ((ax = this.indexOf(what)) !== -1) {
      this.splice(ax, 1)
    }
  }
  return this
}

window.getTransformation = function (transform) {
  // Create a dummy g for calculation purposes only. This will never
  // be appended to the DOM and will be discarded once this function 
  // returns.
  var g = document.createElementNS("http://www.w3.org/2000/svg", "g")
  
  // Set the transform attribute to the provided string value.
  g.setAttributeNS(null, "transform", transform)
  
  // consolidate the SVGTransformList containing all transformations
  // to a single SVGTransform of type SVG_TRANSFORM_MATRIX and get
  // its SVGMatrix. 
  var matrix = g.transform.baseVal.consolidate().matrix
  
  // Below calculations are taken and adapted from the private function
  // transform/decompose.js of D3's module d3-interpolate.
  var {a, b, c, d, e, f} = matrix // ES6, if this doesn't work, use below assignment
  // var a=matrix.a, b=matrix.b, c=matrix.c, d=matrix.d, e=matrix.e, f=matrix.f; // ES5
  var scaleX, scaleY, skewX
  if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX
  if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX
  if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY
  if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX
  return {
    translateX: e,
    translateY: f,
    rotate: Math.atan2(b, a) * 180 / Math.PI,
    skewX: Math.atan(skewX) * 180 / Math.PI,
    scaleX: scaleX,
    scaleY: scaleY
  }
}

window.setProjPointsOpacity = function (digit, opacity = 1) {
  d3.selectAll('.projPoints')
    .filter(function () {
      return d3.select(this).attr('digit') === String(digit)
    })
    .style('fill-opacity', opacity)
  d3.selectAll('.projPoints')
    .filter(function () {
      return d3.select(this).attr('digit') !== String(digit)
    })
    .style('fill-opacity', 0.01)
}
window.resetProjPointsOpacity = function () {
  d3.selectAll('.projPoints').each(function () {
    const opacity = Number(d3.select(this).attr('opc'))
    d3.select(this)
      .style('fill-opacity', opacity)
  })
}

import store from './store/index.js'
new Vue({
  el: '#app',
  store,
  router,
  components: { App },
  template: '<App/>'
})
