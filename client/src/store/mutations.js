/*
* @Author: wakouboy
* @Date:   2018-08-08 23:31:53
* @Last Modified by:   wakouboy
* @Last Modified time: 2019-01-16 13:52:28
*/
import types from './mutation-type.js';
import Vue from 'vue'
export default {
  [types.UPDATE_LOADING_PAGE] (state, payload) {
    // let newObj = {}
    // Object.keys(payload).forEach(dKey => {
    //   newObj[dKey] = payload[dKey]
    // })
    state.loadingPage = payload
  },
  [types.UPDATE_UPDATE_SUB_LIST] (state, payload) {
    let newObj = {}
    Object.keys(payload).forEach(dKey => {
      newObj[dKey] = payload[dKey]
    })
    state.updateSubList = newObj
  },
  [types.UPDATE_UPDATE_MAP_BY_DIM] (state, payload) {
    let newObj = {}
    Object.keys(payload).forEach(dKey => {
      newObj[dKey] = payload[dKey]
    })
    state.updateMapByDim = newObj
  },
  [types.UPDATE_UPDATE_MAP_BY_SUB] (state, payload) {
    let newObj = {}
    Object.keys(payload).forEach(dKey => {
      newObj[dKey] = payload[dKey]
    })
    state.updateMapBySub = newObj
  },
  [types.UPDATE_CHANGE_LEVEL_BY_PANEL] (state, payload) {
    let newObj = {}
    Object.keys(payload).forEach(dKey => {
      newObj[dKey] = payload[dKey]
    })
    state.changeLevelByPanel = newObj
  },
  [types.UPDATE_CHANGE_LEVEL_BY_MAP] (state, payload) {
    let newObj = {}
    Object.keys(payload).forEach(dKey => {
      newObj[dKey] = payload[dKey]
    })
    state.changeLevelByMap = newObj
  },
  [types.UPDATE_CHANGE_MODE] (state, payload) {
    let newObj = {}
    Object.keys(payload).forEach(dKey => {
      newObj[dKey] = payload[dKey]
    })
    state.changeMode = newObj
  },
  [types.UPDATE_DRAW_PROJECTION] (state, payload) {
    let newObj = {}
    Object.keys(payload).forEach(dKey => {
      newObj[dKey] = payload[dKey]
    })
    state.drawProjection = newObj
  },
  [types.UPDATE_CHANGE_PROJ_IN_BROWSE_MODE] (state, payload) {
    let newObj = {}
    Object.keys(payload).forEach(dKey => {
      newObj[dKey] = payload[dKey]
    })
    state.changeProjInBrowseMode = newObj
  },
  [types.UPDATE_UPDATE_MAP] (state, payload) {
    let newObj = {}
    Object.keys(payload).forEach(dKey => {
      newObj[dKey] = payload[dKey]
    })
    state.updateMap = newObj
  },
  [types.UPDATE_RESIZE] (state, payload) {
    // let newObj = {}
    // Object.keys(payload).forEach(dKey => {
    //   newObj[dKey] = payload[dKey]
    // })
    state.resize = Math.random()
  },
  [types.UPDATE_CHANGE_SUB_PROJ_OPACITY] (state, payload) {
    let newObj = {}
    Object.keys(payload).forEach(dKey => {
      newObj[dKey] = payload[dKey]
    })
    state.changeSubProjOpacity = newObj
  },
};