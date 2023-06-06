/*
* @Author: wakouboy
* @Date:   2018-08-08 23:32:06
* @Last Modified by:   wakouboy
* @Last Modified time: 2019-01-16 13:52:43
*/
import types from './mutation-type.js';

export default {
  updateLoadingPage ({commit}, payload) {
    commit(types.UPDATE_LOADING_PAGE, payload)
  },
  updateUpdateSubList ({commit}, payload) {
    commit(types.UPDATE_UPDATE_SUB_LIST, payload)
  },
  updateUpdateMapByDim ({commit}, payload) {
    commit(types.UPDATE_UPDATE_MAP_BY_DIM, payload)
  },
  updateUpdateMapBySub ({commit}, payload) {
    commit(types.UPDATE_UPDATE_MAP_BY_SUB, payload)
  },
  updateChangeLevelByPanel ({commit}, payload) {
    commit(types.UPDATE_CHANGE_LEVEL_BY_PANEL, payload)
  },
  updateChangeLevelByMap ({commit}, payload) {
    commit(types.UPDATE_CHANGE_LEVEL_BY_MAP, payload)
  },
  updateChangeMode ({commit}, payload) {
    commit(types.UPDATE_CHANGE_MODE, payload)
  },
  updateDrawProjection ({commit}, payload) {
    commit(types.UPDATE_DRAW_PROJECTION, payload)
  },
  updateChangeProjInBrowseMode ({commit}, payload) {
    commit(types.UPDATE_CHANGE_PROJ_IN_BROWSE_MODE, payload)
  },
  updateUpdateMap ({commit}, payload) {
    commit(types.UPDATE_UPDATE_MAP, payload)
  },
  updateResize ({commit}, payload) {
    commit(types.UPDATE_RESIZE, payload)
  },
  updateChangeSubProjOpacity ({commit}, payload) {
    commit(types.UPDATE_CHANGE_SUB_PROJ_OPACITY, payload)
  },
};
