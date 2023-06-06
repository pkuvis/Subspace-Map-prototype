/*
* @Author: wakouboy
* @Date:   2018-08-08 23:30:56
* @Last Modified by:   wakouboy
* @Last Modified time: 2019-01-16 13:50:48
*/

const getters = {
  loadingPage: function (state) {
    return state.loadingPage
  },
  loadedData: function (state) {
    return state.loadedData
  },
  updateSubList: function (state) {
    return state.updateSubList
  },
  updateMapByDim: function (state) {
    return state.updateMapByDim
  },
  updateMapBySub: function (state) {
    return state.updateMapBySub
  },
  changeLevelByPanel: function (state) {
    return state.changeLevelByPanel
  },
  changeLevelByMap: function (state) {
    return state.changeLevelByMap
  },
  changeMode: function (state) {
    return state.changeMode
  },
  drawProjection: function (state) {
    return state.drawProjection
  },
  changeProjInBrowseMode: function (state) {
    return state.changeProjInBrowseMode
  },
  updateMap: function (state) {
    return state.updateMap
  },
  resize: function (state) {
    return state.resize
  },
  changeSubProjOpacity: function (state) {
    return state.changeSubProjOpacity
  },
}
// export const loadedData = (state) => {
//     return state.loadedData;
// }

export default getters
