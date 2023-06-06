<template>
  <div id="subMap">
    <div id="map"></div>
    <MapPanel></MapPanel>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import MapLayout from './libs/mapLayout'
import Visibility from './libs/visibility'
import SubGlyph from './libs/subGlyph'
import Route from './libs/route'
import Graph from './libs/graph'

import MapPanel from '@/components/SubMap/panel/MapPanel'

const numeric = require('numeric')
export default {
  name: 'SubMap',
  components: { MapPanel },
  data() {
    return {
      seaRouteDuration: 2500
    }
  },
  mounted() {},
  computed: {
    ...mapGetters([
      'loadedData',
      'updateMapByDim',
      'updateMapBySub',
      'changeLevelByPanel',
      'changeMode',
      'resize'
    ])
  },
  watch: {
    loadedData: function (val, oldVal) {
      this.updateParams()
      if (oldVal != null) {
        this.redraw()
      } else {
        this.init()
        this.draw()
      }
    },
    resize: function (newVal) {
      this.updateParams()
      this.redraw()
    },
    updateMapByDim: function (newVal) {
      this.interactions.filterByDims(newVal.dimStates)
    },
    updateMapBySub: function (newVal) {
      switch (newVal.type) {
        case 'hover':
          this.interactions.filterByIDs(newVal.subIds)
          break
        case 'click':
          this.interactions.pinByIDs(newVal.subIds)
          break
      }
    },
    changeLevelByPanel: function (newVal) {
      let container = this.d3el.select('.SubMapTiling')
      let prevTranslate
      if (container.attr('transform') !== null) {
        prevTranslate = this.getTranslate(container).map(d => -d)
      } else {
        prevTranslate = [0, 0]
      }
      this.visible.toLevel(
        container.node(),
        prevTranslate,
        newVal.level,
        this.transition.long
      )
    },
    changeMode: function (newVal, oldVal) {
      if (oldVal.mode !== undefined) {
        this.prevMode = oldVal.mode
      }
      switch (newVal.mode) {
        case 'browse':
          // mouseout operation
          this.resetSubList()
          this.updateUpdateSubList({
            path2This: null,
            type: 'unclick'
          })
          if (this.prevMode === 'groundTravel') {
            this.updateUpdateSubList({
              path2This: undefined,
              subIds: [...Array(Data.subs.length).keys()],
              type: 'changeShownItems'
            })
            this.resetCapsOpacity()
            this.unselectRoute()
            this.resetTravelRouteSubs()
          }
          this.d3el.select('.SubMapTiling').selectAll('.travelIcon').remove()
          let grids = this.d3el.select('.SubMapTiling').selectAll('.SubMapGrids')
          grids.classed('travelUnselected', false)
            .classed('gridClicked', false)
            .classed('gridUnhovered', false)
            .attr('cursor', 'pointer')
            .attr('opacity', 1)
            .on('mouseover', null)
            .on('mouseout', null)
            .on('click', null)
          this.recoverElemOrder()
          this.bindSubMapClustersEvent()
          break
        case 'airTravel':
          if (this.prevMode === 'groundTravel') {
            this.resetCapsOpacity()
            this.resetTravelRouteSubs()
            this.updateUpdateSubList({
              path2This: undefined,
              subIds: [...Array(Data.subs.length).keys()],
              type: 'changeShownItems'
            })
            this.unselectRoute()
            this.d3el.select('.SubMapTiling').selectAll('.travelIcon').remove()
            let grids = this.d3el.select('.SubMapTiling').selectAll('.SubMapGrids')
            grids.classed('travelUnselected', false)
              .classed('gridClicked', false)
              .attr('cursor', 'pointer')
              .attr('opacity', 1)
              .on('mouseover', null)
              .on('mouseout', null)
              .on('click', null)
          }
          this.resetSubList()
          this.airTravelMode()
          break
        case 'groundTravel':
          if (this.prevMode === 'airTravel') {
            let grids = this.d3el.select('.SubMapTiling').selectAll('.SubMapGrids')
            grids.classed('gridUnhovered', false)
              .classed('gridClicked', false)
              .on('mouseover', null)
              .on('mouseout', null)
              .on('click', null)
            this.d3el.select('.SubMapTiling').selectAll('.travelIcon').remove()
          }
          this.resetSubList()
          this.groundTravelMode()
          break
      }
    }
  },
  methods: {
    ...mapActions([
      'updateLoadingPage',
      'updateUpdateMap',
      'updateUpdateSubList',
      'updateChangeLevelByMap',
      'updateDrawProjection',
      'updateChangeProjInBrowseMode',
      'updateChangeSubProjOpacity'
    ]),
    // showLoadingPage: function () {
    //   this.updateLoadingPage(true)
    //   console.log('updateLoadingPage', this.$store.state.loadingPage)
    // },
    updateParams: function () {
      this.width = this.$el.offsetWidth
      this.height = this.$el.offsetHeight

      this.d3el = d3.select(this.$el).select('#map')

      this.mapWidth = parseFloat(this.d3el.style('width'))
      this.mapHeight = parseFloat(this.d3el.style('height'))

      this.fCodes = filterCodes(Data.subs)
      this.fMatrix = filterMatrix(Data.subs, this.fCodes.dataIndeces)
      this.overallClusters = {
        clusters: null,
        level: null,
        paths: null,
        aggregate: null
      },
      this.currClusters = {
        clusters: null,
        level: null,
        paths: null,
        aggregate: null
      }
      this.dimCounts = null
      this.showSize = Math.min(this.mapWidth, this.mapHeight)
      this.canvasSize = 340
      this.scales = {
        x: d3.scaleLinear()
          .domain([0, 1])
          .range([-this.canvasSize * 0.5, this.canvasSize * 0.5]),
        y: d3.scaleLinear()
          .domain([0, 1])
          .range([-this.canvasSize * 0.5, this.canvasSize * 0.5])
      }
      this.transition = {
        duration: 500,
        long: 2000,
        short: 400,
        interval: 50
      }
      this.pattern = true
      this.interactions = {
        ready: false,
        hoveredID: null
      }
      this.clsColorReady = false
      this.ovlDataWeights = null
      this.sizeTolr = Number.EPSILON * 1000 * (this.showSize / this.canvasSize)
      this.snapshotPar = {
        ringR: null,
        ringRRatio: 0.5,
        marginRatio: 0.01,
        sshotR: null,
        sshotRRatio: 0.05,
        outR: null,
        anchorR: 4,
        angInterval: 2
      }

      this.color = {
        h: d3.scaleLinear().domain([0, 1]).range([0, 360]),
        c: d3.scaleLinear().domain([0, 1]).range([30, 80]),
        l: d3.scaleLinear().domain([0, 1]).range([150 * 0.3, 150 * 0.6]) // d3 l range[0, 150]
      }

      this.travelIcon = 'M513.127753 0C298.854626 0 125.180617 171.418502 125.180617 381.180617c0 164.651982 239.0837 484.933921 340.581498 620.264317 11.277533 13.53304 27.066079 22.555066 45.110132 22.555066s36.088106-9.022026 47.365638-22.555066c101.497797-135.330396 340.581498-455.612335 340.581498-620.264317C901.07489 171.418502 725.145374 0 513.127753 0z m0 518.76652c-90.220264 0-164.651982-72.176211-164.651982-162.396476s74.431718-162.396476 164.651982-162.396476 164.651982 72.176211 164.651983 162.396476-74.431718 162.396476-164.651983 162.396476z'

      this.currTime = 0
      this.travelIconPos = null
      this.isTravelIconDragging = false

      this.subMapClustersEvent = null
      this.prevMode = 'browse'

      function filterCodes (codes) {
        let dimIndices = new Array(codes[0].length)
        for (let i = 0; i < dimIndices.length; i++) {
          dimIndices[i] = i
        }
        return {
          codes: codes,
          dataIndeces: null,
          dimIndeces: dimIndices
        }
      }

      function filterMatrix (codeBook, indices) {
        const diffMat = getDiffMat()
        const distExt = Math.max(...Data.subDistMat.map(row => Math.max(...row)))
        return {
          neighbors: Data.subKNN,
          distMat: Data.subDistMat,
          diffMat: diffMat,
          distExt: distExt,
          colors: Data.colors
        }
      }

      function getDiffMat () {
        let mat = new Array(Data.subs.length)
        for (let i = 0; i < mat.length; i++) {
          mat[i] = new Array(Data.subs.length)
        }

        for (let i = 0; i < mat.length - 1; i++) {
          for (let j = i + 1; j < mat[i].length; j++) {
            const subI = Data.subs[i]
            const subJ = Data.subs[j]
            let diff = 0
            for (let k = 0; k < subI.length; k++) {
              if (subI[k] !== subJ[k]) {
                diff++
              }
            }
            mat[i][j] = diff
          }
        }
        return mat
      }
    },
    init: function () {
      this.svg = this.d3el
        .append('svg')
        .attr('width', this.mapWidth)
        .attr('height', this.mapHeight)
        .append('g')
        .attr('id', 'mapSvg')
        .attr('transform', `translate(${this.mapWidth / 2}, ${this.mapHeight / 2})scale(${this.showSize / this.canvasSize})`)
    },
    redraw: function () {
      this.clear()
      this.init()
      this.draw()
    },
    clear: function () {
      // this.svg.selectAll('*').remove()
      d3.select(this.$el).select('#map').selectAll('*').remove()
    },
    draw: function () {
      let df1 = $.Deferred()
      let df2 = $.Deferred()
      this.initInteractions()
      this.clustering(df1)
      $.when(df1).done(() => {
        this.showTiling(df2)
      })
      $.when(df2).done(() => {
        // this.updateLoadingPage(false)
        setTimeout(() => {
          d3.select('#loading-page').style('display', 'none')
        }, 1000)
        // d3.select('#loading-page').style('display', 'none')
      })
    },
    getTranslate: function (g) {
      let transform = g.attr('transform')
      let leftBracketPos = transform.indexOf('(')
      let commaPos = transform.indexOf(',')
      let rightBracketPos = transform.indexOf(')')
      return [
        parseFloat(transform.substring(leftBracketPos + 1, commaPos)),
        parseFloat(transform.substring(commaPos + 1, rightBracketPos))
      ]
    },
    initInteractions: function() {
      let thisView = this
      let d3el = this.d3el
      let thisCollection = Data
      let interactions = this.interactions
      let transDuration = this.transition.duration
      let filterCodes = this.fCodes
      let overallContainer = thisView.d3el
      if (!interactions.ready) {
        interactions.ready = true
        interactions.duration = transDuration
        interactions.container = thisView.d3el
        interactions.clickTimer = null
        interactions.checkRelation = function(
          path2A,
          path2B,
          relationType
        ) {
          let lengthCondition = false
          let endOFunction = false
          let confirmed = true
          let lengthOParents
          switch (relationType) {
            case 'fellows': // same level
              confirmed = lengthCondition = path2B.length === path2A.length
              endOFunction = true
              break
            case 'brothers': // same level, same parent
              lengthCondition = path2B.length === path2A.length
              lengthOParents = path2A.length - 1
              break
            case 'descendants': // the whole subtree
              lengthCondition = path2B.length > path2A.length // check if A is a parent of B
              lengthOParents = path2A.length
              break
          }
          if (endOFunction) {
            return confirmed
          } // 'fellow' examination ended
          if (!lengthCondition) {
            return false
          }
          for (let i = 0; i < lengthOParents; i++) {
            if (path2B[i] !== path2A[i]) {
              confirmed = false
              break
            }
          } // 'brothers' and 'descendants' must have the same parents
          if (relationType === 'brothers') {
            confirmed =
              confirmed && path2B[lengthOParents] !== path2A[lengthOParents]
          } // 'brothers' must not be the same node
          return confirmed
        } // end of interactions.checkRelation
        interactions.standOut = function(thisContainer, clusterID) {
          // highlight some cluster
          d3.select(thisContainer)
            .selectAll('line')
            .classed('chosen', true)
            .interrupt()
            .transition()
            .duration(transDuration)
            .attr('stroke', '#000')
            .attr('stroke-opacity', 1.0)
          let d3Selection = overallContainer
            .selectAll('.SubMapSShot')
            .filter(function() {
              return d3.select(this).attr('clsID') === clusterID
            })
          bvShowOnTop(d3Selection[0], $(d3Selection[0]).parent()[0])
        } // end of interactions.standOut
        interactions.fadeOutAll = function() {
          overallContainer
            .selectAll('.SubMapClusters path')
            .interrupt()
            .transition()
            .duration(transDuration)
            .attr('fill-opacity', 0.0)
          overallContainer
            .selectAll('.SubMapClusters line')
            .classed('chosen', false)
            .interrupt()
            .transition()
            .duration(transDuration)
            .attr('stroke', '#666')
            .attr('stroke-opacity', 0.8)
        } // end of interactions.fadeOutAll
        interactions.fadeOutOthers = function(className) {
          // Fade out other clusters and outliers
          let fadedSelection = overallContainer
            .selectAll('.SubMapClusters')
            .filter(function(d, i) {
              return className !== d3.select(this).attr('class')
            })
          fadedSelection
            .selectAll('path')
            .interrupt()
            .transition()
            .duration(transDuration)
            .attr('fill-opacity', 0.8)
          fadedSelection
            .selectAll('line')
            .interrupt()
            .transition()
            .duration(transDuration)
            .attr('stroke-opacity', 0)
        } // end of interactions.fadeOutOthers
        interactions.saveBrothers = function(path2Cluster) {
          let checkRelationFunction = this.checkRelation
          let brotherSelection = overallContainer
            .selectAll('.SubMapClusters')
            .filter(function(elemOThis, orderOThis) {
              let path2This = d3.select(this).attr('clsID')
              if (path2This != null) {
                path2This = path2This.split('_')
              }
              if (d3.select(this).classed('Outliers')) {
                let path2Parent = path2Cluster.slice(
                  0,
                  path2Cluster.length - 1
                )
                return checkRelationFunction(
                  path2Parent,
                  path2This,
                  'descendants'
                )
              } else {
                return checkRelationFunction(
                  path2Cluster,
                  path2This,
                  'brothers'
                )
              }
            })
          brotherSelection
            .selectAll('path')
            .interrupt()
            .transition()
            .duration(transDuration)
            .attr('fill-opacity', 0.1)
          brotherSelection
            .selectAll('line')
            .interrupt()
            .transition()
            .duration(transDuration)
            .attr('stroke', '#666')
            .attr('stroke-opacity', 1.0)
        } // end of interactions.saveBrothers
        interactions.mouseOver = function(thisCluster, isOutlier) {
          if (!isOutlier) {
            bvShowOnTop(thisCluster, '.SubMapTiling')
            let path2This = d3.select(thisCluster).attr('clsID')
            if (path2This != null && path2This.length > 0) {
              path2This = path2This.split('_')
              let idsOThis = this.filterByIDs(
                thisView.getClsByPath.call(thisView, path2This)
              )
              let dataWeightsOThis = thisCollection.subtree.findByIndex(path2This).data.dataWeights
              let overallDataWeights = (thisView.ovlDataWeights = thisCollection.subtree.data.dataWeights)
              dataWeightsOThis = numeric.sub(overallDataWeights, dataWeightsOThis)
              this.informOthers(idsOThis, dataWeightsOThis, false)
              // thisView.informOthers(
              //   'SubMapCollectionView__Highlighting',
              //   path2This
              // )
              thisView.updateUpdateSubList({
                path2This: path2This,
                type: 'mouseover'
              })
            }
            this.standOut(thisCluster, path2This)
          }
        } // end of interactions.mouseOver
        interactions.mouseOut = function(isOutlier) {
          if (!isOutlier) {
            this.fadeOutAll()
            let ids = this.filterByIDs()
            this.informOthers(ids, null, false)
            // thisView.informOthers(
            //   'SubMapCollectionView__Highlighting',
            //   null
            // )
            thisView.updateUpdateSubList({
              path2This: null,
              type: 'mouseout'
            })
            this.filterByIDs()
            this.informOthers()
          }
        } // end of interactions.mouseOut
        interactions.informOthers = function(
          ids,
          dataWeights,
          isTranslate = true,
          isPin = false
        ) {
          let leafNames
          if (ids != null) {
            if (isTranslate) {
              leafNames = thisView.getClsByPath(ids)
            } else {
              leafNames = ids
            }
          }
          let message
          if (isPin) {
            if (isTranslate === false) {
              this.projectByIDs(leafNames)
            } else {
              this.projectByCluster(ids)
            }
            message = 'SubMapCollectionView__Pin'
          } else {
            message = 'SubMapCollectionView__Choose'
          }
          // thisView.informOthers(message, {
          //   attr: 'index',
          //   IDs: leafNames,
          //   weights: dataWeights,
          //   inform: false
          // })
        } // end of interactions.informOthers
        interactions.pinning = function(thisContainer, isBlock = true) {
          let targetSelection = d3.select(thisContainer)
          let pinned = targetSelection.classed('pinned')
          let clsID
          let leafNames
          d3el.selectAll('.SubMapClusters.pinned').classed('pinned', false)
          if (!pinned) {
            if (isBlock) {
              clsID = targetSelection.attr('clsID').split('_')
              leafNames = thisView.getClsByPath.call(thisView, clsID)
              leafNames = thisView.SubGlyph.pickGlyphsByIDs(d3el, leafNames, 'index')
              targetSelection.classed('pinned', true)
              // thisView.updateUpdateSubList({
              //   path2This: clsID,
              //   type: 'click'
              // })
              thisView.updateUpdateSubList({
                path2This: clsID,
                subIds: undefined,
                type: 'changeShownItems'
              })
              thisView.updateChangeProjInBrowseMode({
                parentClsID: clsID
              })
            } else {
              leafNames = [targetSelection.attr('index')]
              leafNames = thisView.SubGlyph.pickGlyphsByIDs(d3el, leafNames, 'index')
            }
          } else {
            thisView.SubGlyph.pickGlyphsByIDs(d3el, null, 'index')
            // thisView.updateUpdateSubList({
            //   path2This: null,
            //   type: 'unclick'
            // })
            // thisView.updateUpdateSubList({
            //   path2This: undefined,
            //   subIds: undefined,
            //   type: 'changeShownItems'
            // })
            thisView.resetSubList()
            thisView.updateUpdateSubList({
              path2This: null,
              type: 'unclick'
            })
            thisView.updateUpdateSubList({
              path2This: undefined,
              subIds: [...Array(Data.subs.length).keys()],
              type: 'changeShownItems'
            })
            thisView.updateChangeProjInBrowseMode({
              parentClsID: null
            })
            // targetSelection.classed("pinned", false);
          }
          if (isBlock === true) {
            this.informOthers(clsID, null, true, true)
          } else {
            this.informOthers(leafNames, null, false, true)
          }
        }
        // end of interactions.pinning
        interactions.filterByDims = function(filterSettings) {
          let returnedData = {
            indeces: thisView.SubGlyph.filterGlyphsByDims(
              d3el,
              filterSettings,
              'index',
              null,
              filterCodes.codes
            ),
            illegal:
              filterSettings.filter(d => {
                return d !== 0
              }).length < 2
          }
          // thisCollection.trigger('Transmission', {
          //   type: 'trans',
          //   message: 'SubMapCollectionView__Filtering',
          //   data: returnedData
          // })
          let indeces = returnedData.indeces
          if (indeces.length == filterCodes.codes.length) {
            interactions.projectByIDs(null)
          } else {
            interactions.projectByIDs(returnedData.indeces)
          }
        } // end of interactions.filterByDims
        interactions.filterByIDs = function(leafNames) {
          return thisView.SubGlyph.filterGlyphsByIDs(d3el, leafNames, 'index')
        } // end of interactions.filterByIDs
        interactions.pinByIDs = function(leafNames) {
          d3el.selectAll('.SubMapClusters.pinned').classed('pinned', false)
          thisView.SubGlyph.pickGlyphsByIDs(d3el, leafNames)
          this.projectByIDs(leafNames)
        } // end of interactions.pinByIDs
        interactions.projectByIDs = function(leafNames) {
          // Case 1:   the default projection
          if (leafNames == null || leafNames.length === 0) {
            // thisCollection.trigger('Transmission', {
            //   type: 'trans',
            //   message: 'SubMapCollectionView__DefaultProjection',
            //   data: null
            // })
          } else {
            // let codeBook = thisCollection.subIndex
            let codeBook = thisCollection.subs
            // Case 2:   an individual subspace, show it
            if (leafNames.length === 1) {
              let codesOTarget = codeBook[leafNames[0]]
              // thisCollection.trigger('Transmission', {
              //   type: 'trans',
              //   message: 'SubMapCollectionView__ShowProjection',
              //   data: this.fixCode(codesOTarget)
              // })
            } else {
              // Case 3:   multiple subspaces, hide it
              // thisCollection.trigger('Transmission', {
              //   type: 'trans',
              //   message: 'SubMapCollectionView__HideProjection',
              //   data: true
              // })
            }
          }
        } // interactions.projectByIDs
        interactions.projectByCluster = function(cid) {
          // thisCollection.trigger('Transmission', {
          //   type: 'trans',
          //   message: 'SubMapCollectionView__ShowCluster',
          //   data: cid
          // })
        } // interactions.projectByCluster
        interactions.fixCode = function(targetCodes) {
          let dimCover = thisView.dimCover
          let dimLength = dimCover.length
          let code = new Array(dimLength)
          let count = 0
          for (let i = 0; i < dimLength; i++) {
            if (dimCover[i] >= 0) {
              code[i] = dimCover[i]
            } else {
              code[i] = targetCodes[count]
              count++
            }
          }
          return code
        } // end of interactions.fixCode
        // interactions.zoomByDims = function(targetData) {
        //   let subZoom = zooming => {
        //     let free = 0
        //     let fixed = 0
        //     for (let i = 0; i < thisView.dimCover.length; i++) {
        //       if (thisView.dimCover[i] < 0) {
        //         free++
        //       } else {
        //         fixed++
        //       }
        //     }
        //     if ((zooming && free < 3) || (!thisView.zoomed && !zooming)) {
        //     } else {
        //       if (!zooming || (zooming && free < thisView.freeDim)) {
        //         thisView.zoomed = zooming
        //         thisView.freeDim = zooming ? free : thisView.dimCover.length
        //         thisView.pipeline()
        //       }
        //     }
        //   }
        //   let dims = targetData.dims
        //   let zooming = targetData.zoomin
        //   if (dims != null) {
        //     thisView.dimCover = dims
        //     subZoom(zooming)
        //   }
        // } // end of interactions.zoomByDims
      }
    },
    getClsByPath: function(path2This, getIndices = true) {
      let dataIndices = this.fCodes.dataIndeces
      let levelOThis = path2This.length - 1
      let pathLevel = this.currClusters.paths[levelOThis]
      let prevCode = path2This.slice(0, path2This.length - 1).join('_')
      let IDOThis = path2This[path2This.length - 1]
      let returnedIDs = pathLevel.filter(path2Cluster => {
        if (path2Cluster.outlier) {
          return false
        }
        let code = path2Cluster.previous.join('_')
        return code === prevCode
      })[0].ids[IDOThis]
      if (getIndices && dataIndices != null) {
        let treturnedIDs = new Array(returnedIDs.length)
        for (let i = 0; i < returnedIDs.length; i++) {
          treturnedIDs[i] = dataIndices[returnedIDs[i]] + ''
        }
        returnedIDs = treturnedIDs
      } else {
        for (let i = 0; i < returnedIDs.length; i++) {
          returnedIDs[i] = returnedIDs[i] + ''
        }
      }
      return returnedIDs
    },
    clustering: function (df) {
      const self = this
      if (this.overallClusters.clusters == null) {
        storeCluster()
        this.overallClusters = this.currClusters
      } else {
        this.currClusters = this.overallClusters
      }

      function storeCluster () {
        self.currClusters.clusters = Data.subHierClusters
        self.currClusters.level = getArrDepth(self.currClusters.clusters) - 1

        class clusterInfoObj {
          constructor(v_prevObj, v_treePath, v_isOutlier = false, v_neighborPatterns, v_dimCounts) {
            let neighborPatterns = new Map()
            let prevPatterns = v_prevObj ? v_prevObj.patterns : null
            let dimCounts = new Array(Data.dims.length).fill(0)
            let prevDimCounts = v_prevObj ? v_prevObj.dimCounts : null
            let treePath = []
            this.dimCounts = v_dimCounts == null ? prevDimCounts || dimCounts : v_dimCounts
            this.patterns = v_neighborPatterns == null ? prevPatterns || neighborPatterns : v_neighborPatterns
            this.index = v_treePath == null ? treePath : v_treePath
            this.outliers = v_isOutlier
          }
          combine (v_clusterInfoObj) {
            this.dimCounts = numeric.add(this.dimCounts, v_clusterInfoObj.dimCounts)
            this.patterns = combineMaps(this.patterns, v_clusterInfoObj.patterns, combineVals)

            function combineMaps (map1, map2, combineFunc) {
              let map = new Map()
              const map1Arr = Array.from(map1.entries())
              const map2Arr = Array.from(map2.entries())
              let matchArr1 = new Array(map1Arr.length).fill(false)
              let matchArr2 = new Array(map2Arr.length).fill(false)
              for (let i = 0; i < map1Arr.length; i++) {
                const key1 = map1Arr[i][0]
                const val1 = map1Arr[i][1]
                for (let j = 0; j < map2Arr.length; j++) {
                  const key2 = map2Arr[j][0]
                  const val2 = map2Arr[j][1]
                  let newVal
                  if (key1 == key2) {
                    newVal = combineFunc(val1, val2)
                    if (!map.has(key1)) {
                      map.set(key1, newVal)
                    } else {
                      const origVal = map.get(key1)
                      newVal = combineFunc(origVal, newVal)
                      map.set(key1, newVal)
                    }
                    matchArr1[i] = true
                    matchArr2[j] = true
                  }
                }
              }
              for (let i = 0; i < matchArr1.length; i++) {
                if (!matchArr1[i]) {
                  const key = map1Arr[i][0]
                  const val = map1Arr[i][1]
                  if (!map.has(key)) {
                    map.set(key, val)
                  } else {
                    const origVal = map.get(key)
                    const newVal = combineFunc(origVal, val)
                    map.set(key, newVal)
                  }
                }
              }
              for (let i = 0; i < matchArr2.length; i++) {
                if (!matchArr2[i]) {
                  const key = map2Arr[i][0]
                  const val = map2Arr[i][1]
                  if (!map.has(key)) {
                    map.set(key, val)
                  } else {
                    const origVal = map.get(key)
                    const newVal = combineFunc(origVal, val)
                    map.set(key, newVal)
                  }
                }
              }
              return map
            }

            function combineVals (i, j) {
              return i + j
            }
          }
        }
        
        aggregate()

        function aggregate () {
          // local dim weights of each subspace
          let overallNeighborDims = new Array(Data.subs.length)
          for (let i = 0; i < overallNeighborDims.length; i++) {
            overallNeighborDims[i] = new Array(Data.dims.length).fill(0)
          }
          // shared dimensions in each pair of ngh subspaces
          let maskMap = new Map()
          maskMap.findPair = function (i, j) {
            const key = i < j ? i + '_' + j : j + '_' + i
            return this.get(key)
          }
          maskMap.setPair = function (i, j, mask) {
            let key = i < j ? i + '_' + j : j + '_' + i
            for (let k = 0; k < mask.length; k++) {
              if (mask[k] == '1') {
                overallNeighborDims[i][k]++
                overallNeighborDims[j][k]++
              }
            }
            return this.set(key, mask)
          }
          self.currClusters.aggregate = traverseTree(self.currClusters.clusters, subtreeFunc, leavesFunc)
          overallNeighborDims.extent = {
            min: Math.min(...overallNeighborDims.map(row => Math.min(...row))),
            max: Math.max(...overallNeighborDims.map(row => Math.max(...row)))
          }
          self.neighborDims = overallNeighborDims
          simplifyTree(self.currClusters.aggregate)
          df.resolve()

          function traverseTree (tree, subtreeFunc, leavesFunc) {
            let res = traverseTreeLevel(tree, subtreeFunc, leavesFunc, [])
            let resTree = res.subtree
            resTree.supernode = subtreeFunc(res.subtree, [])
            return resTree
          }

          function traverseTreeLevel (tree, subtreeFunc, leavesFunc, path) {
            if (tree.length == null) {
              return null
            }
            let newTree = []
            let supernodes = []
            let subLeaves = []
            let leafIndices = []
            let onlyLeaves = true
            for (let i = 0; i < tree.length; i++) {
              let subtree = tree[i]
              if (subtree.length != null) {
                let newPath = [...path, i]
                let subRes = traverseTreeLevel(subtree, subtreeFunc, leavesFunc, newPath)
                let newSubtree = subRes.subtree
                newSubtree.supernode = subtreeFunc(newSubtree, newPath)
                supernodes.push(newSubtree)
                newTree.push(newSubtree)
                onlyLeaves = false
              } else {
                subLeaves.push(subtree)
                leafIndices.push(i)
              }
            }
            let leafRes = leavesFunc(subLeaves, onlyLeaves, [...path, leafIndices])
            subLeaves = leafRes.leafnode
            subLeaves.supernode = leafRes.supernode
            supernodes.push(leafRes.supernode)
            newTree.push(subLeaves)
            return {
              subtree: newTree,
              supernodes: supernodes
            }
          }

          function subtreeFunc (subNodes, treePath) {
            if (subNodes.length == 1) {
              let clusterInfo = new clusterInfoObj(subNodes[0].supernode, treePath)
              return clusterInfo
            }
            let clusterInfo = new clusterInfoObj(null, treePath)
            if (subNodes.length == 0) {
              return clusterInfo
            }
            for (let i = 0; i < subNodes.length; i++) {
              clusterInfo.combine(subNodes[i].supernode)
            }
            return clusterInfo
          }

          function leavesFunc (leaves, onlyLeaves, treePath) {
            let clusterInfo = new clusterInfoObj(null, treePath, !onlyLeaves)
            let patternMap = clusterInfo.patterns
            let dimCounts = clusterInfo.dimCounts
            for (let i = 0; i < leaves.length; i++) {
              let idx = leaves[i]
              let neighbors = Data.subKNN[idx]
              let subI = Data.subs[idx]
              // collect dimension patterns (i.e. local dim weights)
              for (let j = 0; j < neighbors.length; j++) {
                let neighbor = neighbors[j]
                let subJ = Data.subs[neighbor]
                let dimExtent = maskMap.findPair(idx, neighbor)
                let neighborDims
                if (dimExtent == null) {
                  neighborDims = new Array(Data.dims.length).fill(0)
                  for (let k = 0; k < subI.length; k++) {
                    if (subI[k] == subJ[k]) {
                      neighborDims[k] = 1
                    }
                  }
                  neighborDims = neighborDims.join('')
                  maskMap.setPair(idx, neighbor, neighborDims)
                } else {
                  neighborDims = dimExtent
                }
                if (!patternMap.has(neighborDims)) {
                  patternMap.set(neighborDims, 0)
                }
                patternMap.set(neighborDims, patternMap.get(neighborDims) + 1)
              }
              // collect dimension counts
              for (let j = 0; j < subI.length; j++) {
                if (subI[j] == 1) {
                  dimCounts[j]++
                }
              }
            }
            return {
              supernode: clusterInfo,
              leafnode: leaves
            }
          }

          function simplifyTree (tree) {
            let res = new Array(self.neighborDims[0].length).fill(0)
            for (let i = 0; i < tree.length; i++) {
              let childRes = new Array(self.neighborDims[0].length).fill(0)
              if (typeof tree[i][0] == 'object') {
                childRes = simplifyTree(tree[i])
              } else {
                for (let j = 0; j < tree[i].length; j++) {
                  childRes = numeric.add(childRes, overallNeighborDims[tree[i][j]])
                }
                tree[i].supernode.neighborDims = childRes
              }
              res = numeric.add(res, childRes)
            }
            tree.supernode.neighborDims = res
            return res
          }
        }

        function getArrDepth (arr) {
          if (Array.isArray(arr)) {
            return 1 + Math.max(...arr.map(t => getArrDepth(t)))
          } else {
            return 0
          }
        }
      }
    },
    showTiling: function (df) {
      const self = this
      let map = new MapLayout(Data.subtree, Data.subDistMat, Data.subs, 2)
      map.getMap()
      this.map = map
      this.updateUpdateMap({
        map: map,
        resize: true
      })

      const gridScales = this.scales
      let centerPosition = [
        (gridScales.x.range()[1] + gridScales.x.range()[0]) * 0.5,
        (gridScales.y.range()[1] + gridScales.y.range()[0]) * 0.5
      ]
      let viewSize = [
        gridScales.x.range()[1] - gridScales.x.range()[0],
        gridScales.y.range()[1] - gridScales.y.range()[0]
      ]
      let df4Map = $.Deferred()
      let df4Route = $.Deferred()
      let df4Cls = $.Deferred()
      let coordsRange = map.coordsRange
      coordsRange = Math.max(coordsRange.x.max - coordsRange.x.min, coordsRange.y.max - coordsRange.y.min)
      this.glyphSize = (viewSize[0] * map.cellRadius) / coordsRange
      this.d3el
        .select('.SubMapTiling')
        .classed('SubMapTiling', false)
        .classed('SubOldTiling', true)
      this.visible = Visibility(
        this,
        centerPosition,
        viewSize[0],
        this.glyphSize,
        this.currClusters.level,
        Data.colors,
        this.transition.duration,
        this.updateChangeLevelByMap
      )
      // let container = this.visible.prepareContainer(this.d3el)
      let container = this.visible.prepareContainer(this.svg)
      container.append('rect')
        .attr('class', 'SubMapTilingFrame')
        .attr('x', -this.mapWidth / 2)
        .attr('y', -this.mapHeight / 2)
        .attr('width', this.mapWidth)
        .attr('height', this.mapHeight)
      this.renderMap(df4Map, container, map)
      $.when(df4Map).done(() => {
        this.showClusters(map, gridScales)
        this.visible.update([0, 0], 1.0)
        this.clsColorReady = true
        this.updateClusterInfo()
        df4Cls.resolve()
      })
      $.when(df4Cls).done(() => {
        this.showRoutes(df4Route, map, gridScales)
      })
      $.when(df4Route).done(() => {
        this.showCaps(map, gridScales)
        this.addBorderToLeaves()
        container.selectAll('.SubMapGrids')
        .on('dblclick', function (d) {
          if (d3.event.shiftKey) {
            const index =  Number(d3.select(this).attr('index'))
            let prevTranslate
            if (container.attr('transform') !== null) {
              prevTranslate = self.getTranslate(container).map(d => -d)
            } else {
              prevTranslate = [0, 0]
            }
            let level
            let clsID
            let centerCoords
            let leafNames
            let parentClsID
            // 如果是islands，则没有操作
            if (Data.subtree.leaves.indexOf(index) > -1) return
            // 如果当前是在provincial level，则回到national level
            if (!container.select('.SubCls_0').classed('visible') && container.select('.SubCls0_0').classed('visible')) {
              level = 0
              clsID = Number(findIndex(index, Data.subHierClusters)[0])
              centerCoords = self.currClusters.paths[0][0].paths[clsID].center
              leafNames = null
              parentClsID = []
            } else if (!container.select('.SubCls0_0').classed('visible')) { // urban level，回到provincial level
              level = 1
              const highlightedGridIndex = getHighlightedGridIndex()
              clsID = findIndex(highlightedGridIndex, Data.subHierClusters).split(',').map(Number)
              centerCoords = self.currClusters.paths[1][clsID[0]].paths[clsID[1]].center
              parentClsID = [clsID[0]]
              leafNames = self.getClsByPath.call(self, parentClsID.map(String))
              container.selectAll('.SubMapClusters.pinned').classed('pinned', false)
            }
            self.visible.toLevel(
              container.node(),
              numeric.add(centerCoords.map(d => d * -1), prevTranslate),
              level,
              self.transition.long
            )
            self.updateChangeLevelByMap({ level: level })
            self.SubGlyph.pickGlyphsByIDs(self.d3el, leafNames, 'index')
            self.updateUpdateSubList({
              path2This: parentClsID,
              subIds: undefined,
              type: 'changeShownItems'
            })
            self.updateChangeProjInBrowseMode({
              parentClsID: parentClsID
            })
          }
        })
      
      function findIndex (valueToSearch, theArray, currentIndex) {
        if (currentIndex == undefined) currentIndex = ''
        if (Array.isArray(theArray)) {
          for (var i = 0; i < theArray.length; i++) {
            if (Array.isArray(theArray[i])) {
              let newIndex = findIndex(valueToSearch, theArray[i], currentIndex + i + ',')
              if (newIndex) return newIndex
            } else if (theArray[i] == valueToSearch) {
              return currentIndex + i
            }
          }
        } else if (theArray == valueToSearch) {
          return currentIndex + i
        }
        return false
      }
        df.resolve()
      })

      function getHighlightedGridIndex () {
        const highlightedGrids = container.selectAll('.SubMapGrids').filter(function() {
          return d3.select(this).style('opacity') > 0.2
        })
        return Number(d3.select(highlightedGrids._groups[0][0]).attr('index'))
      }

      df.resolve()
    },
    renderMap: function (df, container, map) {
      let dfOThis = $.Deferred()
      // this.hideOldMap(dfOThis, map)
      dfOThis.resolve(0)
      $.when(dfOThis).done(transDuration => {
        this.renderNewMap(container, map, transDuration)
        df.resolve()
      })
    },
    hideOldMap: function (df, map) {
      let glyphSize = this.glyphSize
      let gridScales = this.scales
      let glyphColors = Data.colors
      let longDuration = this.transition.long
      let animationTime = this.visible.toLevel([0, 0], 0, longDuration)
      let dfOThis = $.Deferred()
      setTimeout(() => {
        dfOThis.resolve()
      }, animationTime)
      $.when(dfOThis).done(() => {
        let midDuration = 0
        let endDuration = 0
        df.resolve(midDuration)
        // setTimeout(() => {
        //   df.resolve(midDuration) // midDuration: 'transDuration' for renderNewMap
        // }, endDuration * 0.8)
      })
    },
    renderNewMap: function (container, map, transDuration) {
      let self = this
      let filterCodes = this.fCodes
      let gridScales = this.scales
      let glyphSize = this.glyphSize
      let glyphColors = Data.colors
      let leafNodes = Array.from(map.allLeaves.values())
      let coordsRange = map.coordsRange
      let aspectRatio = coordsRange.aspectRatio
      if (aspectRatio > 1) {
        let centerX = (coordsRange.x.min + coordsRange.x.max) / 2
        let divX = (coordsRange.x.max - coordsRange.x.min) / 2
        gridScales.x.domain([
          centerX - divX * aspectRatio,
          centerX + divX * aspectRatio
        ])
        gridScales.y.domain([coordsRange.y.min, coordsRange.y.max])
      } else {
        let centerY = (coordsRange.y.min + coordsRange.y.max) / 2
        let divY = (coordsRange.y.max - coordsRange.y.min) / 2
        gridScales.x.domain([coordsRange.x.min, coordsRange.x.max])
        gridScales.y.domain([
          centerY - divY / aspectRatio,
          centerY + divY / aspectRatio
        ])
      }
      this.SubGlyph = SubGlyph(
        glyphSize,
        glyphSize,
        'cell',
        'fan',
        glyphColors
      )
      // Step 1:   render containers for the cells
      console.log('leafNodes: ', leafNodes)
      let thisContainer = container
        .selectAll('.SubMapGrids')
        .data(leafNodes)
        .enter()
        .append('g')
        .attr('class', 'SubMapGrids')
        .attr('index', cell => {
          if (filterCodes.dataIndeces == null) {
            return cell.ID
          } else {
            return filterCodes.dataIndeces[cell.ID]
          }
        })
        .attr('gSize', glyphSize)
        .classed('empty', cell => {
          return cell.ID == null
        })
        .attr('position', cell => {
          let centerCoords = cell.center.coordinates
          return bScale(gridScales, [
            centerCoords.x,
            centerCoords.y
          ]).join('_')
        })
        .attr('transform', cell => {
          let centerCoords = cell.center.coordinates
          return (
            'translate(' +
            bScale(gridScales, [centerCoords.x, centerCoords.y]) +
            ')'
          )
        })
      // '.SubMapTiling':   the top-level g container
      this.d3el
        .selectAll('.SubMapTiling')
        .attr('opacity', 0)
        .transition()
        .duration(transDuration)
        .attr('opacity', 1)
      // Step 2:   prepare the cell parameters - colors and neighbors
      let filterMatrix = this.fMatrix
      let nghDistScale = d3.scaleLinear()
        .domain([filterMatrix.distExt.min, filterMatrix.distExt.max])
        .range([0, 0.8])
      let dimWeights = this.neighborDims
      let pattern = this.pattern
      // cellFunction:   render function for each cell
      let cellFunction = function (containerCell) {
        let cell = d3.select(containerCell).data()[0]
        let leafName = cell.ID // leafName
        // Step 2-1:   get the color of the cell
        let colorOCell = glyphColors[leafName] // color of this cell
        colorOCell = [
          ~~(255 * colorOCell[0]),
          ~~(255 * colorOCell[1]),
          ~~(255 * colorOCell[2])
        ]
        colorOCell = 'rgb(' + colorOCell + ')'
        // colorOCell = [
        //   self.color.h(colorOCell[0]),
        //   self.color.c(colorOCell[1]),
        //   self.color.l(colorOCell[2])
        // ]
        // colorOCell = d3.hcl(...colorOCell)
        // Step 2-2:   prepare the neighbors
        let neighbors = new Array(6)
        let angleUnit = 60
        for (let i = 0; i < 6; i++) {
          neighbors[i] = {
            angle: ((angleUnit * i) / 180) * Math.PI,
            diff: null,
            dist: null
          }
        }
        // diffScale:   transform the code differences (by unit) into size
        // in mapType 'diff':   needed by subglyph.js for constructing 'bridges'
        neighbors.diffScale = d3.scaleLinear()
          .domain([1, filterCodes.codes[0].Length])
          .range([0, (glyphSize * Math.sqrt(3) * 2) / 3])

        // Step 2-2:  still preparing the neighbors
        for (let neighbor of cell.neighbors) {
          let nghIntPos = neighbor[1]
          let nghIndex = nghIntPos.join('_')
          if (map.occupied.has(nghIndex)) {
            // the neighbor cell is also a leaf
            let nghLeafName = map.occupied.get(nghIndex)
            let nghID = Math.round(neighbor[0] / angleUnit)
            neighbors[nghID].dist = nghDistScale(
              filterMatrix.distMat[leafName][nghLeafName]
            )
            neighbors[nghID].diff =
              filterMatrix.diffMat[leafName][nghLeafName]
          }
        }
        // end of Step 2-2
        // Step 2-3:   prepare the dimension weights
        let weights = dimWeights[leafName]
        let parameters = [
          d3.select(containerCell),
          neighbors,
          leafName,
          filterCodes.codes[leafName],
          colorOCell,
          pattern,
          weights,
          dimWeights.extent
        ]
        if (leafName == null) {
          emptyCellParameters.add(parameters)
        } else {
          cellParameters.add(parameters)
        }
      } // end of cellFunction
      let emptyCellParameters = new Set()
      let cellParameters = new Set()
      thisContainer._groups.forEach(function(container) {
        container.forEach(cellFunction) // end of containerRow.forEach
      }) // end of thisContainer.forEach
      // Step 3:   render the cells
      let interactions = this.interactions
      cellParameters.forEach(cellParameter => {
        let cellContainer = this.SubGlyph.showGlyph(...cellParameter)
        cellContainer.on('click', function(cell) {
          if (cell.id == null) {
            return
          }
          interactions.pinning(this, false)
        })
      }) // render non-empty cells
    },
    showClusters: function (map, scales) {
      let clusterPaths = []
      let levels = this.currClusters.level
      if (this.overallClusters.paths != null) {
        clusterPaths = this.currClusters.paths
      } else {
        let cluster = this.currClusters.clusters
        for (let i = 0; i < levels; i++) {
          clusterPaths.push([])
        }
        this.getContourTree(map, cluster, clusterPaths, 0, [], null)
        this.currClusters.paths = clusterPaths
      }
      for (let i = clusterPaths.length; i > 0; i--) {
        let clusterLevel = clusterPaths[i - 1]
        for (let j = 0; j < clusterLevel.length; j++) {
          let pathData = clusterLevel[j]
          this.renderPaths(
            pathData.paths,
            'SubCls' + pathData.previous.join('_'),
            pathData.previous,
            pathData.outlier,
            scales
          )
        }
      }
      this.updateClusterInfo()
    },
    getContourTree: function (map, clusterIndices, contourTree, currentLevel, previousPath, idOThis) {
      let cluster = []
      let outlier = []
      let returnedCluster = []
      for (let i = 0; i < clusterIndices.length; i++) {
        if (clusterIndices[i].length != null) {
          let simpleCluster
          let previousID = previousPath.slice(0)
          previousID.push(i)
          simpleCluster = this.getContourTree(
            map,
            clusterIndices[i],
            contourTree,
            currentLevel + 1,
            previousID,
            i
          )
          cluster.push(simpleCluster)
          returnedCluster.push(...simpleCluster)
        } else {
          returnedCluster.push(clusterIndices[i])
          outlier.push(clusterIndices[i])
        }
      }
      if (cluster.length > 0) {
        let paths = map.getClusterContours(cluster)
        contourTree[currentLevel].push({
          previous: previousPath,
          selfID: idOThis + '',
          paths: paths,
          ids: cluster,
          outlier: false
        })
      }
      return returnedCluster
    },
    renderPaths: function (clusterIndicesPaths, classNames, previousPath, isOutlier, scales) {
      let interactions = this.interactions
      let clusterLevel = previousPath.length
      let self = this
      let cluster = this.d3el
        .select('.SubMapTiling')
        .selectAll('.' + classNames)
        .data(clusterIndicesPaths)
        .enter()
        .append('g')
        .attr('class', (d, index) => {
          return (
            'SubMapClusters ' +
            classNames +
            '_' +
            index +
            (isOutlier ? ' Outliers' : '')
          )
        })
        .attr('clsID', (d, index) => {
          return [...previousPath, index].join('_')
        })
        .attr('fill-opacity', 0.0)
        .on('mouseover', function(d, index) {
          let clusterID = d3.select(this).attr('clsID')
          if (interactions.hoveredID !== clusterID) {
            interactions.hoveredID = clusterID
            interactions.mouseOver(this, isOutlier)
            self.updateChangeSubProjOpacity({
              action: 'mouseover',
              clsID: clusterID,
              opacity: 0.2
            })
          }
        })
        .on('mouseout', (d, index) => {
          interactions.hoveredID = null
          interactions.mouseOut(isOutlier)
          self.updateChangeSubProjOpacity({
            action: 'mouseout',
            clsID: null,
            opacity: 1
          })
        })
        .on('click', function(d, index) {
          bDelay('clickPinning', 300, () => {
            interactions.pinning(this)
          })
        })
        // .on('dblclick', (d, index) => {
        //   bClearDelay('clickPinning')
        //   if (!isOutlier) {
        //     this.visible.toLevel(
        //       d.center,
        //       d.clsLevel + 1,
        //       this.transition.long
        //     )
        //   }
        // })
        .on('dblclick', function (d, index) {
          bClearDelay('clickPinning')
          if (isOutlier) return
          const container = self.d3el.select('.SubMapTiling')
          let prevTranslate
          if (container.attr('transform') !== null) {
            prevTranslate = self.getTranslate(container).map(d => -d)
          } else {
            prevTranslate = [0, 0]
          }
          let clsID = d3.select(this).attr('clsID').split('_')
          if (d3.event.shiftKey) {
            // 只能从第二层回到第一层
            // 因为第三层已经不是.SubMapClusters了
            d3.event.preventDefault()
            d3.event.stopPropagation()
            clsID = clsID.slice(0, clsID.length - 1)
            const centerCoords = self.currClusters.paths[0][0].paths[Number(clsID[0])].center
            self.visible.toLevel(
              this.parentNode,
              numeric.add(centerCoords.map(d => d * -1), prevTranslate),
              d.clsLevel - 1,
              self.transition.long
            )
            self.updateChangeLevelByMap({
              level: d.clsLevel - 1
            })
            self.SubGlyph.pickGlyphsByIDs(self.d3el, null, 'index')
            clsID = []
          } else {
            self.updateChangeLevelByMap({
              level: d.clsLevel + 1
            })
            self.visible.toLevel(
              this.parentNode,
              // d.center,
              numeric.add(prevTranslate, d.center),
              d.clsLevel + 1,
              self.transition.long
            )
          }
          self.updateUpdateSubList({
            path2This: clsID,
            subIds: undefined,
            type: 'changeShownItems'
          })
          self.updateChangeProjInBrowseMode({
            parentClsID: clsID
          })
        })
      let renderFunction = function(edge, index) {
        let startCoordinates = [
          edge.start.coordinates.x,
          edge.start.coordinates.y
        ]
        let endCoordinates = [
          edge.end.coordinates.x,
          edge.end.coordinates.y
        ]
        let start = bScale(scales, startCoordinates)
        let end = bScale(scales, endCoordinates)
        let line = [start, end].join('_')
        d3.select(this)
          .attr('pos', line)
          .selectAll('line')
          .data([edge])
          .enter()
          .append('line')
          .attr('x1', start[0])
          .attr('y1', start[1])
          .attr('x2', end[0])
          .attr('y2', end[1])
          .attr('stroke', '#666')
      }
      cluster.call(clsContainers => {
        clsContainers._groups[0].forEach(clsContainer => {
          let clusterPaths = d3.select(clsContainer).data()[0]
          let paths = []
          let rangePath = []
          let rangePts
          let diameter = 0
          // draw block paths
          for (let i = 0; i < clusterPaths.paths.length; i++) {
            let clusterPath = clusterPaths.paths[i]
            let pathPoints = clusterPath.points
            let startPoint = bScale(scales, [
              pathPoints[0].coordinates.x,
              pathPoints[0].coordinates.y
            ])
            let path = 'M' + startPoint
            for (let j = 1; j < pathPoints.length; j++) {
              let point = bScale(scales, [
                pathPoints[j].coordinates.x,
                pathPoints[j].coordinates.y
              ])
              path += ' L' + point
              rangePath.push(point)
            }
            if (clusterPath.closed) {
              path += 'L' + startPoint
            }
            paths.push(path)
          }
          for (let i = 0; i < rangePath.length - 1; i++) {
            for (let j = i + 1; j < rangePath.length; j++) {
              let distance = bGetDistance(rangePath[i], rangePath[j])
              if (distance > diameter) {
                diameter = distance
                rangePts = [i, j]
              }
            }
          }
          for (let i = 0; i < rangePts.length; i++) {
            rangePts[i] = rangePath[rangePts[i]]
          }
          clusterPaths.center = bGetMeanVector(rangePts, false)
          clusterPaths.diameter = diameter
          clusterPaths.clsLevel = clusterLevel
          d3.select(clsContainer)
            .selectAll('path')
            .data(paths)
            .enter()
            .append('path')
            .attr('d', p => {
              return p
            })
          // draw edge lines
          if (!d3.select(clsContainer).classed('Outliers')) {
            d3.select(clsContainer)
              .append('g')
              .attr('class', 'SubClsPaths')
              .selectAll('.SubClsPath')
              .data(clusterPaths.lines)
              .enter()
              .append('g')
              .attr('class', 'SubClsPath')
              .each(renderFunction)
          }
        })
      })
    },
    updateClusterInfo: function (v_init = true) {
      if (!this.clsColorReady) {
        return
      }
      if (v_init) {
        let t_initClsProjections = () => {
          let t_centers = new Array(),
            t_aggr = this.currClusters.aggregate,
            t_tree = Data.subtree,
            t_findCol = v_clsIDs => {
              let t_visibleList = this.currClusters.visible[
                  v_clsIDs.length - 1
                ],
                t_clsID = v_clsIDs.join('_'),
                t_visibleItem = t_visibleList.filter(v_visibleItem => {
                  return v_visibleItem.clsID == t_clsID
                })[0]
              return t_visibleItem.avgCol
            },
            t_findWeight = v_clsIDs => {
              let t_children = t_aggr
              for (let i = 0; i < v_clsIDs.length; i++) {
                t_children = t_children[v_clsIDs[i]]
              }
              // test here
              /* let t_weights = t_children.supernode.nghDims */
              let t_weights = t_children.supernode.dimensions
              /* t_weights = numeric.div(t_weights, Math.max(...t_weights)) */
              return t_weights
            }
          let t_collection = Data
          this.d3el.selectAll('.SubMapClusters').each(function(t_d) {
            let t_this = d3.select(this),
              t_outliers = t_this.classed('Outliers')
            if (t_outliers) {
              return
            }
            let t_clsID = t_this.attr('clsID').split('_'),
              t_subTree = t_collection.subtree.findByIndex(t_clsID),
              t_weights = t_subTree.data.dataWeights,
              t_ovlWeights =
                this.ovlDataWeights == undefined
                  ? t_collection.subtree.data.dataWeights
                  : this.ovlDataWeights
            t_weights = numeric.sub(t_weights, t_ovlWeights)
            let t_cid = t_clsID.length - 1,
              t_info = {
                center: t_d.center,
                clsID: t_clsID,
                color: t_findCol(t_clsID),
                count: t_tree.findByIndex(t_clsID).dict.length,
                weights: t_findWeight(t_clsID),
                data: t_weights
              }
            if (t_centers[t_cid] == undefined) {
              t_centers[t_cid] = []
            }
            t_centers[t_cid].push(t_info)
          })
          // this.informOthers('SubMapCollectionView__InitClusters', t_centers)
        }
        t_initClsProjections()
      } else {
        let t_updateClsProjections = () => {
          let t_centers = new Array(),
            t_aggr = this.currClusters.aggregate,
            t_tree = Data.subtree,
            t_findVisible = v_clsIDs => {
              let t_visibleList = this.currClusters.visible[
                v_clsIDs.length - 1
              ]
              let t_clsID = v_clsIDs.join('_')
              let t_visibleItem = t_visibleList.filter(v_visibleItem => {
                return v_visibleItem.clsID == t_clsID
              })[0]
              return t_visibleItem.visible
            }
          this.d3el.selectAll('.SubMapClusters').each(function(t_d) {
            let t_this = d3.select(this),
              t_outliers = t_this.classed('Outliers')
            if (t_outliers) {
              return
            }
            let clsID = t_this.attr('clsID').split('_')
            let cid = clsID.length - 1
            let info = {
              clsID: t_this.attr('clsID'),
              visible: t_findVisible(clsID)
            }
            if (t_centers[cid] === undefined) {
              t_centers[cid] = []
            }
            t_centers[cid].push(info)
          })
          // this.informOthers(
          //   'SubMapCollectionView__UpdateClusters',
          //   t_centers
          // )
        }
        t_updateClsProjections()
      }
    },
    showRoutes: function (df, map, scales) {
      const self = this
      const leafNodes = Array.from(map.allLeaves.values())
      const url = `./../../../static/data/${Data.file}/route.json`
      $.ajax({
        url: url,
        dataType: 'json',
        error: function () {
          console.log('route file load fail')
          routeOperation(undefined)
        },
        success: function (data) {
          console.log('route file load success')
          routeOperation(data)
        }
      })

      function routeOperation (data) {
        const date1 = new Date()
        self.Route = Route(leafNodes, scales, data)
        self.Route.draw(self.d3el.select('.SubMapTiling'))
        const date2 = new Date()
        console.log('duration: ', (date2 - date1) / 1000)
        console.log('Route: ', self.Route)
        df.resolve()
      }

      // let leafNodes = Array.from(map.allLeaves.values())
      // this.Route = Route(leafNodes, scales)
      // console.log('Route: ', this.Route)
      // this.Route.draw(this.d3el.select('.SubMapTiling'))
    },
    showCaps: function (map, scales) {
      let showNationalMark = (vv_g, v_inR, v_outR, v_outStrokeWidth) => {
        vv_g.append('circle')
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('r', v_outR)
          .style('fill', '#fff')
          .style('stroke', '#000')
          .style('stroke-width', v_outStrokeWidth)
        vv_g.append('circle')
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('r', v_inR)
          .style('fill', '#000')
      }
      let showProvincialMark = (vv_g, vv_r, v_outStrokeWidth) => {
        vv_g.append('circle')
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('r', vv_r)
          .style('fill', '#fff')
          .style('stroke', '#000')
          .style('stroke-width', v_outStrokeWidth)
      }

      let leafNodes = Array.from(map.allLeaves.values())
      let r = this.glyphSize * 2 * Math.sqrt(3) / 3
      let capG = this.d3el.select('.SubMapTiling').append('g').attr('class', 'mapCaps')
      let nationalCapsCoords = []
      let provincialCapsCoords = []
      for (let i = 0; i < Data.nationalCaps.length; i++) {
        let node = leafNodes.find(node => node.ID === Data.nationalCaps[i])
        nationalCapsCoords.push(bScale(scales, Object.values(node.center.coordinates)))
      }
      for (let i = 0; i < Data.provincialCaps.length; i++) {
        let node = leafNodes.find(node => node.ID === Data.provincialCaps[i])
        provincialCapsCoords.push(bScale(scales, Object.values(node.center.coordinates)))
      }
      capG.selectAll('.nationalCaps')
        .data(nationalCapsCoords)
        .enter()
        .append('g')
        .attr('class', 'nationalCaps')
        .classed('caps', true)
        .attr('index', (d, i) => Data.nationalCaps[i])
        .attr('transform', d => `translate(${d[0]}, ${d[1]})`)
        .each(function () {
          showNationalMark(d3.select(this), r * 0.3, r * 0.6, r * 0.2)
        })
      capG.selectAll('.provincialCaps')
        .data(provincialCapsCoords)
        .enter()
        .append('g')
        .attr('class', 'provincialCaps')
        .classed('caps', true)
        .attr('index', (d, i) => Data.provincialCaps[i])
        .attr('transform', d => `translate(${d[0]}, ${d[1]})`)
        .each(function () {
          showProvincialMark(d3.select(this), r * 0.45, r * 0.2)
        })
    },
    addBorderToLeaves: function () {
      d3.selectAll('.SubMapGrids').filter(function () {
        return Data.subtree.leaves.indexOf(Number(d3.select(this).attr('index'))) !== -1
      }).each(function () {
        d3.select(this).select('.cell')
          .style('stroke', '#ccc')
          .style('stroke-width', '0.05rem')
          .style('stroke-linecap', 'round')
      })
    },
    groundTravelMode: function () {
      const self = this
      let leafNodes = Array.from(this.map.allLeaves.values())
      this.cancelSubMapClustersEventBinding()
      this.changeElemOrder()
      let grids = this.d3el.select('.SubMapTiling').selectAll('.SubMapGrids')
      let caps = Data.nationalCaps.concat(Data.provincialCaps)
      let capGrids = grids.filter(function () {
        return caps.indexOf(Number(d3.select(this).attr('index'))) !== -1
      })
      let nonCapGrids = grids.filter(function () {
        return caps.indexOf(Number(d3.select(this).attr('index'))) === -1
      })
      let capGs = this.d3el.select('.SubMapTiling').select('.mapCaps').selectAll('.caps')
      nonCapGrids
        .attr('cursor', 'default')
        .transition()
        .duration(this.transition.duration)
        .attr('opacity', 0.2)
      this.updateUpdateSubList({
        path2This: undefined,
        subIds: caps,
        type: 'changeShownItems'
      })
      let clickCount = 0
      let route = []
      capGrids
        .on('mouseover', function () { self.travelModeHoverGrid(d3.select(this), capGrids) })
        .on('mouseout', function () { self.travelModeUnhoverGrid(d3.select(this), capGrids, 'groundTravel') })
        .on('click', clickGrid)
      capGs
        .on('mouseover', function () {
          let thisIndex = d3.select(this).attr('index')
          let thisGrid = self.d3el.select('.SubMapTiling').selectAll('.SubMapGrids')
            .filter(function () { return d3.select(this).attr('index') === thisIndex })
          self.travelModeHoverGrid(thisGrid, capGrids)
        })
        .on('mouseout', function () {
          let thisIndex = d3.select(this).attr('index')
          let thisGrid = self.d3el.select('.SubMapTiling').selectAll('.SubMapGrids')
            .filter(function () { return d3.select(this).attr('index') === thisIndex })
          self.travelModeUnhoverGrid(thisGrid, capGrids, 'groundTravel')
        })
        .on('click', clickGrid)

      function clickGrid () {
        let thisIndex = d3.select(this).attr('index')
        clickCount++
        if (clickCount % 2 === 1) {
          // origin
          self.d3el.select('.SubMapTiling').selectAll('.travelIcon').remove()
          self.unselectRoute()
          self.updateUpdateSubList({
            path2This: undefined,
            subIds: caps,
            type: 'changeShownItems'
          })
          self.resetCapsOpacity()
          self.resetTravelRouteSubs()
          route = []
          route.push(Number(thisIndex))
          capGrids.classed('travelUnselected', false)
          capGrids.classed('gridClicked', false)
          capGrids
            .filter(function () {
              return d3.select(this).attr('index') === thisIndex
            })
            .classed('gridClicked', true)
          self.drawTravelIcon(d3.select(this))
          self.updateDrawProjection({
            type: 'origin',
            subId: Number(thisIndex)
          })
        } else {
          if (route[0] === Number(thisIndex)) {
            self.d3el.select('.SubMapTiling').selectAll('.travelIcon').remove()
            self.travelIconPos = null
            capGrids.classed('gridClicked', false)
            capGrids.classed('travelUnselected', false)
            return
          }
          // destination
          route.push(Number(thisIndex))
          capGrids
            .filter(function () {
              return d3.select(this).attr('index') === thisIndex
            })
            .classed('gridClicked', true)
          capGrids
            .filter(function () {
              return route.indexOf(Number(d3.select(this).attr('index'))) === -1
            })
            .classed('travelUnselected', true)
          // construct the route
          let clsID0 = Number(findIndex(route[0], Data.subHierClusters)[0])
          let clsID1 = Number(findIndex(route[1], Data.subHierClusters)[0])
          let travelRouteSubs
          let travelRouteCoords
          let travelRouteOD
          if (clsID0 === clsID1) {
            // case 1: two nodes belong to the same continent
            let mstGraph = self.Route.landMST[clsID0]
            let graph = constructGraph(mstGraph)
            let travelRoute = graph.findShortestPath(route[0], route[1]).map(Number)
            travelRouteOD = travelRoute
            travelRouteSubs = getLandRouteSubs(travelRoute, self.Route.landRoute[clsID0])
            travelRouteCoords = getRouteCoords('land', travelRoute, self.Route.landRoute[clsID0], self.Route.landRouteCoords[clsID0])
          } else {
            // case 2: two nodes do not belong to the same continent
            let mstGraph0 = self.Route.landMST[clsID0]
            let mstGraph1 = self.Route.landMST[clsID1]
            let graph0 = constructGraph(mstGraph0)
            let graph1 = constructGraph(mstGraph1)
            let harbor0 = getHarborByClsID(clsID0)
            let harbor1 = getHarborByClsID(clsID1)
            let travelRoute0 = graph0.findShortestPath(route[0], harbor0).map(Number)
            travelRouteOD = JSON.parse(JSON.stringify(travelRoute0))
            let travelRoute1 = graph1.findShortestPath(harbor1, route[1]).map(Number)
            let waterRouteInfo = getWaterRouteInfo([clsID0, clsID1])
            let waterRouteSubs = waterRouteInfo['subs']
            travelRouteSubs = getLandRouteSubs(travelRoute0, self.Route.landRoute[clsID0])
            travelRouteSubs.pop()
            travelRouteSubs.push(...waterRouteSubs)
            travelRouteOD.pop()
            travelRouteOD.push(...waterRouteInfo['OD'])
            travelRouteOD.pop()
            travelRouteOD.push(...JSON.parse(JSON.stringify(travelRoute1)))
            travelRouteSubs.pop()
            travelRouteSubs.push(...getLandRouteSubs(travelRoute1, self.Route.landRoute[clsID1]))
            
            travelRouteCoords = getRouteCoords('land', travelRoute0, self.Route.landRoute[clsID0], self.Route.landRouteCoords[clsID0])
            travelRouteCoords.pop()
            travelRouteCoords.push(...waterRouteInfo['coords'])
            travelRouteCoords.pop()
            travelRouteCoords.push(...getRouteCoords('land', travelRoute1, self.Route.landRoute[clsID1], self.Route.landRouteCoords[clsID1]))

            if (travelRoute1.length === 1) {
              // 只有一个harbor，需要将其包含在路径里
              travelRouteSubs.push(harbor1)
              let node = leafNodes.find(node => node.ID === harbor1)
              let nodeCoords = bScale(self.scales, Object.values(node.center.coordinates))
              travelRouteCoords.push({
                x: nodeCoords[0],
                y: nodeCoords[1]
              })
            }
            /* if (Data.nationalCaps.indexOf(route[0]) !== -1 && Data.nationalCaps.indexOf(route[1]) !== -1) {
              // case 2.1: nodes are both national capitals
              let waterRouteInfo = getWaterRouteInfo([clsID0, clsID1])
              travelRouteSubs = waterRouteInfo['subs']
              travelRouteCoords = waterRouteInfo['coords']
              travelRouteOD = waterRouteInfo['OD']
              // travelRouteSubs = getWaterRouteSubs([clsID0, clsID1])
              // travelRouteCoords = getWaterRouteCoords([clsID0, clsID1])
              // travelRouteOD = getWaterRouteOD(travelRouteSubs)
            } else if (Data.nationalCaps.indexOf(route[0]) === -1 && Data.nationalCaps.indexOf(route[1]) !== -1) {
              // case 2.2: one of the two nodes is the national capitals
              let nationalCap0 = Data.nationalCaps[clsID0]
              let mstGraph = self.Route.landMST[clsID0]
              let graph = constructGraph(mstGraph)
              let travelRoute = graph.findShortestPath(route[0], nationalCap0).map(Number)
              travelRouteSubs = getLandRouteSubs(travelRoute, self.Route.landRoute[clsID0])
              travelRouteSubs.pop()
              travelRouteOD = JSON.parse(JSON.stringify(travelRoute))

              let waterRouteInfo = getWaterRouteInfo([clsID0, clsID1])
              // let waterRouteSubs = getWaterRouteSubs([clsID0, clsID1])
              let waterRouteSubs = waterRouteInfo['subs']
              travelRouteSubs.push(...waterRouteSubs)
              travelRouteOD.pop()
              // travelRouteOD.push(...getWaterRouteOD(waterRouteSubs))
              travelRouteOD.push(...waterRouteInfo['OD'])
              
              travelRouteCoords = getRouteCoords('land', travelRoute, self.Route.landRoute[clsID0], self.Route.landRouteCoords[clsID0])
              travelRouteCoords.pop()
              // travelRouteCoords.push(...getWaterRouteCoords([clsID0, clsID1]))
              travelRouteCoords.push(...waterRouteInfo['coords'])
            } else if (Data.nationalCaps.indexOf(route[0]) !== -1 && Data.nationalCaps.indexOf(route[1]) === -1) {
              let waterRouteInfo = getWaterRouteInfo([clsID0, clsID1])
              let waterRouteSubs = waterRouteInfo['subs']
              travelRouteSubs = waterRouteSubs
              travelRouteOD = waterRouteInfo['OD']
              travelRouteCoords = waterRouteInfo['coords']
              let nationalCap1 = Data.nationalCaps[clsID1]
              let mstGraph = self.Route.landMST[clsID1]
              let graph = constructGraph(mstGraph)
              let travelRoute = graph.findShortestPath(nationalCap1, route[1]).map(Number)
              travelRouteOD.pop()
              travelRouteOD.push(...travelRoute)
              travelRouteSubs.pop()
              travelRouteSubs.push(...getLandRouteSubs(travelRoute, self.Route.landRoute[clsID1]))
              
              travelRouteCoords.pop()
              travelRouteCoords.push(...getRouteCoords('land', travelRoute, self.Route.landRoute[clsID1], self.Route.landRouteCoords[clsID1]))
            } else {
              // case 2.3: neither node is the capital
              let mstGraph0 = self.Route.landMST[clsID0]
              let mstGraph1 = self.Route.landMST[clsID1]
              let nationalCap0 = Data.nationalCaps[clsID0]
              let nationalCap1 = Data.nationalCaps[clsID1]
              let graph0 = constructGraph(mstGraph0)
              let graph1 = constructGraph(mstGraph1)
              let travelRoute0 = graph0.findShortestPath(route[0], nationalCap0).map(Number)
              travelRouteOD = JSON.parse(JSON.stringify(travelRoute0))
              let travelRoute1 = graph1.findShortestPath(nationalCap1, route[1]).map(Number)

              let waterRouteInfo = getWaterRouteInfo([clsID0, clsID1])
              let waterRouteSubs = waterRouteInfo['subs']
              travelRouteSubs = getLandRouteSubs(travelRoute0, self.Route.landRoute[clsID0])
              travelRouteSubs.pop()
              travelRouteSubs.push(...waterRouteSubs)
              travelRouteOD.pop()
              travelRouteOD.push(...waterRouteInfo['OD'])
              travelRouteOD.pop()
              travelRouteOD.push(...JSON.parse(JSON.stringify(travelRoute1)))
              travelRouteSubs.pop()
              travelRouteSubs.push(...getLandRouteSubs(travelRoute1, self.Route.landRoute[clsID1]))
              
              travelRouteCoords = getRouteCoords('land', travelRoute0, self.Route.landRoute[clsID0], self.Route.landRouteCoords[clsID0])
              travelRouteCoords.pop()
              travelRouteCoords.push(...waterRouteInfo['coords'])
              travelRouteCoords.pop()
              travelRouteCoords.push(...getRouteCoords('land', travelRoute1, self.Route.landRoute[clsID1], self.Route.landRouteCoords[clsID1]))
            } */
          }
          let repeatingRouteSubIdPairs = getRepeatingElemIdPairs(travelRouteSubs)
          let removedRouteSubs = removeRepeatingElems(travelRouteSubs, repeatingRouteSubIdPairs)
          removeRepeatingElems(travelRouteCoords, repeatingRouteSubIdPairs)
          let repeatingRouteODIdPairs = getRepeatingElemIdPairs(travelRouteOD)
          removeRepeatingODs(travelRouteOD, repeatingRouteODIdPairs, removedRouteSubs)
          console.log('travelRouteSubs: ', travelRouteSubs)
          let countryDivisionIndices = [0]
          let highlightLandRouteCoords = [[]]
          for (let i = 0; i < travelRouteSubs.length - 1; i++) {
            let sub = travelRouteSubs[i]
            let nextSub = travelRouteSubs[i + 1]
            if (self.Route.harbor.indexOf(sub) > -1 && self.Route.harbor.indexOf(nextSub) > -1) {
              countryDivisionIndices.push((i + 1))
              highlightLandRouteCoords[highlightLandRouteCoords.length - 1].push(...self.Route.landSubCoords.get(sub))
              highlightLandRouteCoords.push([])
            } else if (self.Route.harbor.indexOf(sub) > -1 && self.Route.harbor.indexOf(nextSub) === -1) {
              let coords = JSON.parse(JSON.stringify(self.Route.landSubCoords.get(sub)))
              highlightLandRouteCoords[highlightLandRouteCoords.length - 1].push(...coords.reverse())
            } else {
              highlightLandRouteCoords[highlightLandRouteCoords.length - 1].push(self.Route.landSubCoords.get(sub))
            }
          }
          countryDivisionIndices.push(travelRouteSubs.length)
          let lastSub = travelRouteSubs[travelRouteSubs.length - 1]
          if (self.Route.harbor.indexOf(lastSub) > -1) {
            highlightLandRouteCoords[highlightLandRouteCoords.length - 1].push(self.Route.landSubCoords.get(lastSub)[0])
            if (clsID0 !== clsID1) {
              // 跨国，且终点国家只有一个harbor
              highlightLandRouteCoords[highlightLandRouteCoords.length - 1].push(self.Route.landSubCoords.get(lastSub)[1])
            }
          } else {
            highlightLandRouteCoords[highlightLandRouteCoords.length - 1].push(self.Route.landSubCoords.get(lastSub))
          }
          console.log('highlightLandRouteCoords', highlightLandRouteCoords)
          self.fadeIrrelevantRoutesAndCaps(highlightLandRouteCoords, travelRouteOD)
          self.highlightTravelRouteSubs(travelRouteSubs)
          self.updateUpdateSubList({
            path2This: undefined,
            subIds: Array.from(new Set(caps.concat(travelRouteSubs))),
            type: 'changeShownItems'
          })
          let interval = 800
          // let duration = travelRouteCoords.length * interval
          let travelRouteSubsInCountry = getRouteArrInCountry(travelRouteSubs, countryDivisionIndices)
          let travelRouteCoordsInCountry = getRouteArrInCountry(travelRouteCoords, countryDivisionIndices)
          let durations = []
          for (let i = 0; i < travelRouteSubsInCountry.length; i++) {
            durations.push((travelRouteSubsInCountry[i].length * interval))
          }
          self.travelIconPos = Number(thisIndex)
          self.updateDrawProjection({
            type: 'destination',
            subId: Number(thisIndex)
          })
          travelInCountry(interval, durations, travelRouteSubs, travelRouteCoords, countryDivisionIndices, travelRouteSubsInCountry, travelRouteCoordsInCountry, 0)

          // let timer = setInterval(function () {
          //   if (self.currTime >= duration) {
          //     clearInterval(timer)
          //     self.currTime = 0
          //     self.d3el.select('.SubMapTiling').select('.travelIcon')
          //       .call(d3.drag().on('drag', function () { dragged(d3.select(this), travelRouteSubs) }))
          //   } else {
          //     let idx = self.currTime / interval
          //     if (idx > 0) {
          //       self.updateDrawProjection({
          //         type: 'transition',
          //         subId: travelRouteSubs[idx]
          //       })
          //     }
          //     self.updateView(travelRouteCoords[idx], travelRouteSubs[idx])
          //     self.currTime += interval
          //   }
          // }, interval)
        }

        function findIndex (valueToSearch, theArray, currentIndex) {
          if (currentIndex == undefined) currentIndex = ''
          if (Array.isArray(theArray)) {
            for (var i = 0; i < theArray.length; i++) {
              if (Array.isArray(theArray[i])) {
                let newIndex = findIndex(valueToSearch, theArray[i], currentIndex + i + ',')
                if (newIndex) return newIndex
              } else if (theArray[i] == valueToSearch) {
                return currentIndex + i
              }
            }
          } else if (theArray == valueToSearch) {
            return currentIndex + i
          }
          return false
        }

        function constructGraph (mstGraph) {
          let graph = {}
          let uniqueVertexes = getUniqueVertexes(mstGraph)
          for (let i = 0; i < uniqueVertexes.length; i++) {
            let vertex = uniqueVertexes[i]
            let neighborNodes = {}
            for (let j = 0; j < mstGraph.length; j++) {
              if (mstGraph[j].u === vertex) {
                neighborNodes[mstGraph[j].v] = mstGraph[j].w
              } else if (mstGraph[j].v === vertex) {
                neighborNodes[mstGraph[j].u] = mstGraph[j].w
              }
            }
            graph[vertex] = neighborNodes
          }
          return new Graph(graph)

          function getUniqueVertexes (mstGraph) {
            let uniqueU = [...new Set(mstGraph.map(item => item.u))]
            let uniqueV = [...new Set(mstGraph.map(item => item.v))]
            return Array.from(new Set(uniqueU.concat(uniqueV)))
          }
        }

        function getHarborByClsID (ID) {
          for (let i = 0; i < self.Route.harbor.length; i++) {
            if (Number(findIndex(self.Route.harbor[i], Data.subHierClusters)[0]) === ID) {
              return self.Route.harbor[i]
            }
          }
        }

        function getLandRouteSubs (travelRoute, v_landRoute) {
          const landRoute = JSON.parse(JSON.stringify(v_landRoute))
          let subs = []
          let routeIds = Object.keys(landRoute)
          for (let i = 0; i < travelRoute.length - 1; i++) {
            let routePair = [travelRoute[i], travelRoute[i + 1]]
            // let routeId
            let pairSubs
            if (routeIds.indexOf(String(routePair)) > -1) {
              // routeId = routeIds.indexOf(String(routePair))
              pairSubs = landRoute[routePair]
            } else {
              // routeId = routeIds.indexOf(String(routePair.reverse()))
              pairSubs = [...landRoute[routePair.reverse()]].reverse()
            }
            if (i === travelRoute.length - 2) {
              subs.push(...pairSubs)
            } else {
              pairSubs.pop()
              subs.push(...pairSubs)
            }
          }
          return subs
        }

        function getRouteCoords (routeType, travelRoute, v_route, v_routeCoords) {
          const route = JSON.parse(JSON.stringify(v_route))
          const routeCoords = JSON.parse(JSON.stringify(v_routeCoords))
          let coords = []
          let routeIds = Object.keys(route)
          for (let i = 0; i < travelRoute.length - 1; i++) {
            let routePair = [travelRoute[i], travelRoute[i + 1]]
            let routeId
            let pairCoords
            if (routeType === 'land') {
              if (routeIds.indexOf(String(routePair)) > -1) {
                routeId = routeIds.indexOf(String(routePair))
                pairCoords = routeCoords[routeId]
              } else {
                routeId = routeIds.indexOf(String(routePair.reverse()))
                pairCoords = [...routeCoords[routeId]].reverse()
              }
            } else if (routeType === 'water') {
              if (routeIds.indexOf(String(routePair)) > -1) {
                pairCoords = routeCoords[String(routePair)]
              } else {
                pairCoords = [...routeCoords[String(routePair.reverse())]].reverse()
              }
            }
            if (i === travelRoute.length - 2) {
              coords.push(...pairCoords)
            } else {
              pairCoords.pop()
              coords.push(...pairCoords)
            }
          }
          return coords
        }
        
        function getWaterRouteCoords (clsIds) {
          let routeIds = Object.keys(self.Route.waterRouteCoords)
          if (routeIds.indexOf(String(clsIds)) > -1) {
            return JSON.parse(JSON.stringify(self.Route.waterRouteCoords[clsIds]))
          } else {
            return JSON.parse(JSON.stringify(self.Route.waterRouteCoords[[clsIds[1], clsIds[0]]])).reverse()
          }
        }

        function getWaterRouteInfo (clsIds) {
          let info = {}

          let mstGraph = self.Route.waterMST
          let graph = constructGraph(mstGraph)
          let travelRoute = graph.findShortestPath(clsIds[0], clsIds[1]).map(Number)
          let subs = getLandRouteSubs(travelRoute, self.Route.waterRoute)
          let coords = getRouteCoords('water', travelRoute, self.Route.waterRoute, self.Route.waterRouteCoords)
          let od = getWaterRouteOD(subs)

          // let repeatingSubPairs = getRepeatingElemIdPairs(subs, 'sub')
          // removeRepeatingElems(subs, repeatingSubPairs)
          // removeRepeatingElems(coords, repeatingSubPairs)
          // let repeatingODPairs = getRepeatingElemIdPairs(od, 'od')
          // removeRepeatingElems(od, repeatingODPairs)

          info['subs'] = subs
          info['coords'] = coords
          info['OD'] = od

          return info
        }

        function getWaterRouteSubs (clsIds) {
          let mstGraph = self.Route.waterMST
          let graph = constructGraph(mstGraph)
          let travelRoute = graph.findShortestPath(clsIds[0], clsIds[1]).map(Number)
          return getLandRouteSubs(travelRoute, self.Route.waterRoute)
          // let routeIds = Object.keys(self.Route.waterRoute)
          // if (routeIds.indexOf(String(clsIds)) > -1) {
          //   return JSON.parse(JSON.stringify(self.Route.waterRoute[clsIds]))
          // } else {
          //   return JSON.parse(JSON.stringify(self.Route.waterRoute[[clsIds[1], clsIds[0]]])).reverse()
          // }
        }

        function getWaterRouteOD (waterRouteSubs) {
          let waterRouteOD = []
          for (let i = 0; i < waterRouteSubs.length; i++) {
            if (caps.indexOf(waterRouteSubs[i]) !== -1 || self.Route.harbor.indexOf(waterRouteSubs[i]) !== -1) {
              waterRouteOD.push(waterRouteSubs[i])
            }
          }
          return waterRouteOD
        }

        function getRepeatingElemIdPairs (arr) {
          let ids = []
          let accIdNum = 0
          // 可能有很多次中转现象，因此重复id可能有很多组
          for (let i = 0; i < arr.length; i++) {
            let elem = arr[i]
            if (countInArray(arr, elem) > 1) {
              let id2 = get2ndIdOfElem(arr, elem)
              ids.push([i + 1 - accIdNum, id2 - accIdNum])
              accIdNum += id2 - i
              i = id2
            }
          }
          return ids

          function countInArray (arr, elem) {
            return arr.filter(item => item === elem).length
          }

          function get2ndIdOfElem (arr, elem) {
            let count = 0
            for (let i = 0; i < arr.length; i++) {
              if (arr[i] === elem) {
                count++
                if (count === 2) {
                  return i
                }
              }
            }
            return null
          }
        }

        function removeRepeatingElems (arr, repeatingElemIdPairs) {
          let removedElems = []
          for (let i = 0; i < repeatingElemIdPairs.length; i++) {
            let idPair = repeatingElemIdPairs[i]
            let splicedElems = arr.splice(idPair[0], (idPair[1] - idPair[0] + 1))
            removedElems = removedElems.concat(splicedElems)
            removedElems.pop()
          }
          return [...new Set(removedElems)]
        }

        function removeRepeatingODs (arr, repeatingODIdPairs, removedElems) {
          removeRepeatingElems(arr, repeatingODIdPairs)
          let arrLen = arr.length
          let i = 0
          while (i < arrLen) {
            if (removedElems.indexOf(arr[i]) > -1) {
              arr.splice(i, 1)
              arrLen -= 1
            } else {
              i++
            }
          }
        }

        function getRouteArrInCountry (routeArr, countryDivisionIndices) {
          let routeArrInCountry = []
          for (let i = 0; i < countryDivisionIndices.length - 1; i++) {
            routeArrInCountry.push([])
            if (i > 0) {
              // 使用setInterval的时候，会在第一次执行之前等待一段interval
              // 这在经过海路进入后面国家子空间的时候是没有必要的
              // 因此，不把这些国家经过的第一个城市放入数组
              for (let j = countryDivisionIndices[i] + 1; j < countryDivisionIndices[i + 1]; j++) {
                routeArrInCountry[i].push(routeArr[j])
              }
            } else {
              for (let j = countryDivisionIndices[i]; j < countryDivisionIndices[i + 1]; j++) {
                routeArrInCountry[i].push(routeArr[j])
              }
            }
          }
          return routeArrInCountry
        }

        function travelInCountry (interval, durations, travelRouteSubs, travelRouteCoords, countryDivisionIndices, travelRouteSubsInCountry, travelRouteCoordsInCountry, countryIdx) {
          let timer = setInterval(function () {
            if (self.currTime >= durations[countryIdx]) {
              clearInterval(timer)
              self.currTime = 0
              if (countryIdx === durations.length - 1) {
                self.d3el.select('.SubMapTiling').select('.travelIcon')
                  .call(d3.drag().on('drag', function () { dragged(d3.select(this), travelRouteSubs) }))
                return
              } else {
                let harbor1 = travelRouteSubs[countryDivisionIndices[countryIdx + 1] - 1]
                let harbor2 = travelRouteSubs[countryDivisionIndices[countryIdx + 1]]
                let seaRouteOD = [harbor1, harbor2]
                let routeReverse = false
                let seaRoute = self.d3el.select('.SubMapTiling').selectAll('.seaRoute')
                  .filter(function () {
                    let thisOD = d3.select(this).attr('od')
                    return thisOD === String(seaRouteOD)
                  })
                if (seaRoute._groups[0].length === 0) {
                  routeReverse = true
                  seaRouteOD.reverse()
                  seaRoute = self.d3el.select('.SubMapTiling').selectAll('.seaRoute')
                    .filter(function () {
                      let thisOD = d3.select(this).attr('od')
                      return thisOD === String(seaRouteOD)
                    })
                }
                self.d3el.select('.SubMapTiling').select('.travelIcon')
                  .transition()
                  .duration(self.seaRouteDuration)
                  .ease(d3.easePoly.exponent(2))
                  .attrTween("transform", translateAlong(seaRoute.node(), routeReverse))
                  .on('end', function () {
                    let harbor2Coords = travelRouteCoords[countryDivisionIndices[countryIdx + 1]]
                    self.updateDrawProjection({
                      type: 'transition',
                      subId: harbor2
                    })
                    self.updateView(harbor2Coords, harbor2)
                    travelInCountry(interval, durations, travelRouteSubs, travelRouteCoords, countryDivisionIndices, travelRouteSubsInCountry, travelRouteCoordsInCountry, countryIdx + 1)
                  })
              }
            } else {
              let idx = self.currTime / interval
              self.updateDrawProjection({
                type: 'transition',
                subId: travelRouteSubsInCountry[countryIdx][idx]
              })
              self.updateView(travelRouteCoordsInCountry[countryIdx][idx], travelRouteSubsInCountry[countryIdx][idx])
              self.currTime += interval
            }
          }, interval)
        }

        function translateAlong (path, pathReverse) {
          let pathLen = path.getTotalLength()
          return function() {
            return function(t) {
              let p = pathReverse ? path.getPointAtLength(pathLen - t * pathLen) : path.getPointAtLength(t * pathLen)
              // return "translate(" + p.x + "," + p.y + ")"
              return `translate(${[
                p.x - self.travelIconSizeDiff.width,
                p.y - self.travelIconSizeDiff.height
              ]})scale(${self.travelIconScale})`
            }
          }
        }

        function dragged (thisIcon, travelRouteSubs) {
          let node = leafNodes.find(node => node.ID === self.travelIconPos)
          let nodeCoord = bScale(self.scales, [
            node.center.coordinates.x,
            node.center.coordinates.y
          ])
          let candidateNodes = []
          let dists = []
          let dist2Node = Math.sqrt(Math.pow(d3.event.x - nodeCoord[0], 2) + Math.pow(d3.event.y - nodeCoord[1], 2))
          for (let i = 0; i < travelRouteSubs.length; i++) {
            let travelRouteNode = leafNodes.find(node => node.ID === travelRouteSubs[i])
            let travelRouteNodeCoord = bScale(self.scales, [
              travelRouteNode.center.coordinates.x,
              travelRouteNode.center.coordinates.y
            ])
            let dist2TravelRouteNode = Math.sqrt(Math.pow(travelRouteNodeCoord[0] - d3.event.x, 2) + Math.pow(travelRouteNodeCoord[1] - d3.event.y, 2))
            let dist = dist2Node - dist2TravelRouteNode
            if (dist > 0) {
              dists.push(dist)
              candidateNodes.push(travelRouteNode)
            }
          }
          if (dists.length !== 0) {
            let indexOfMinDist = dists.indexOf(Math.min(...dists))
            let nextNode = candidateNodes[indexOfMinDist]
            self.travelIconPos = nextNode.ID
            let nextCoord = [
              self.scales.x(nextNode.center.coordinates.x) - self.travelIconSizeDiff.width,
              self.scales.y(nextNode.center.coordinates.y) - self.travelIconSizeDiff.height
            ]
            thisIcon
              .attr('transform', `translate(${nextCoord})scale(${self.travelIconScale})`)
            self.resetSubList()
            self.updateUpdateSubList({
              path2This: undefined,
              subIds: [self.travelIconPos],
              type: 'mouseover'
            })
            self.updateDrawProjection({
              type: 'transition',
              subId: self.travelIconPos
            })
          }
        }
      }
    },
    airTravelMode: function (params) {
      const self = this
      let leafNodes = Array.from(this.map.allLeaves.values())
      this.cancelSubMapClustersEventBinding()
      this.changeElemOrder()
      let grids = this.d3el.select('.SubMapTiling').selectAll('.SubMapGrids')
      let capGs = this.d3el.select('.SubMapTiling').select('.mapCaps').selectAll('.caps')
      grids
        .on('mouseover', function () { self.travelModeHoverGrid(d3.select(this), grids) })
        .on('mouseout', function () { self.travelModeUnhoverGrid(d3.select(this), grids, 'airTravel') })
        .on('click', function () { clickGrid(d3.select(this)) })
      capGs
        .on('mouseover', function () {
          let thisIndex = d3.select(this).attr('index')
          let thisGrid = self.d3el.select('.SubMapTiling').selectAll('.SubMapGrids')
            .filter(function () { return d3.select(this).attr('index') === thisIndex })
          self.travelModeHoverGrid(thisGrid, grids)
        })
        .on('mouseout', function () {
          let thisIndex = d3.select(this).attr('index')
          let thisGrid = self.d3el.select('.SubMapTiling').selectAll('.SubMapGrids')
            .filter(function () { return d3.select(this).attr('index') === thisIndex })
          self.travelModeUnhoverGrid(thisGrid, grids, 'airTravel')
        })
        .on('click', function () {
          let thisIndex = d3.select(this).attr('index')
          let thisGrid = self.d3el.select('.SubMapTiling').selectAll('.SubMapGrids')
            .filter(function () { return d3.select(this).attr('index') === thisIndex })
          clickGrid(thisGrid)
        })
      
      function clickGrid (thisGrid) {
        let thisIndex = thisGrid.attr('index')
        if (self.travelIconPos === Number(thisIndex)) {
          // 如果该grid已经被点击，则取消点击
          self.d3el.select('.SubMapTiling').selectAll('.travelIcon').remove()
          self.travelIconPos = null
          self.d3el.select('.SubMapTiling').selectAll('.SubMapGrids').classed('gridClicked', false)
          self.updateUpdateSubList({
            path2This: null,
            type: 'unclick'
          })
          self.updateDrawProjection({
            type: 'clear',
            subId: null
          })
        } else {
          // 如果该grid没有被点击
          if (document.getElementsByClassName('travelIcon').length === 0) {
            // 如果没有grid被点击
            self.drawTravelIcon(thisGrid)
            self.d3el.select('.SubMapTiling').select('.travelIcon')
              .call(d3.drag()
                .on('start', () => {
                  self.isTravelIconDragging = true
                })
                .on('drag', dragged))
                .on('end', () => {
                  self.isTravelIconDragging = false
                })
            self.updateDrawProjection({
              type: 'origin',
              subId: Number(thisIndex)
            })
          } else {
            // 如果之前有grid被点击
            self.resetSubList()
            let travelIconCoords = self.getTranslate(thisGrid)
            self.d3el.select('.SubMapTiling').select('.travelIcon')
              .attr('transform', `translate(${[
                travelIconCoords[0] - self.travelIconSizeDiff.width,
                travelIconCoords[1] - self.travelIconSizeDiff.height
              ]})scale(${self.travelIconScale})`)
            self.updateDrawProjection({
              type: 'transition',
              subId: Number(thisIndex)
            })
          }
          self.d3el.select('.SubMapTiling').selectAll('.SubMapGrids').classed('gridClicked', false)
          thisGrid.classed('gridClicked', true)
          self.travelIconPos = Number(thisIndex)
          self.updateUpdateSubList({
            path2This: undefined,
            subIds: [self.travelIconPos],
            type: 'click'
          })
        }
      }
      function dragged () {
        let node = leafNodes.find(node => node.ID === self.travelIconPos)
        let nodeCoord = bScale(self.scales, [
          node.center.coordinates.x,
          node.center.coordinates.y
        ])
        let neighborPositions = Array.from(node.neighbors.values())
        let candidateNodes = []
        let dists = []
        let dist2Node = Math.sqrt(Math.pow(d3.event.x - nodeCoord[0], 2) + Math.pow(d3.event.y - nodeCoord[1], 2))
        for (let i = 0; i < neighborPositions.length; i++) {
          let neighborNode = leafNodes.find(node => JSON.stringify(Object.values(node.position)) === JSON.stringify(neighborPositions[i]))
          if (neighborNode !== undefined) {
            let neighborNodeCoord = bScale(self.scales, [
              neighborNode.center.coordinates.x,
              neighborNode.center.coordinates.y
            ])
            let dist2NeighborNode = Math.sqrt(Math.pow(neighborNodeCoord[0] - d3.event.x, 2) + Math.pow(neighborNodeCoord[1] - d3.event.y, 2))
            let dist = dist2Node - dist2NeighborNode
            if (dist > 0) {
              dists.push(dist)
              candidateNodes.push(neighborNode)
            }
          }
        }
        if (dists.length !== 0) {
          let indexOfMinDist = dists.indexOf(Math.min(...dists))
          let nextNode = candidateNodes[indexOfMinDist]
          self.travelIconPos = nextNode.ID
          let nextCoord = [
            self.scales.x(nextNode.center.coordinates.x) - self.travelIconSizeDiff.width,
            self.scales.y(nextNode.center.coordinates.y) - self.travelIconSizeDiff.height
          ]
          d3.select(this)
            .attr('transform', `translate(${nextCoord})scale(${self.travelIconScale})`)
          let thisGrid = self.d3el.select('.SubMapTiling').selectAll('.SubMapGrids')
            .filter(function () { return d3.select(this).attr('index') === self.travelIconPos + '' })
          self.d3el.select('.SubMapTiling').selectAll('.SubMapGrids').classed('gridClicked', false)
          thisGrid.classed('gridClicked', true)
          self.resetSubList()
          self.updateUpdateSubList({
            path2This: undefined,
            subIds: [self.travelIconPos],
            type: 'click'
          })
          self.updateDrawProjection({
            type: 'transition',
            subId: self.travelIconPos
          })
        }
      }
    },
    travelModeHoverGrid: function (thisGrid, grids) {
      if (this.isTravelIconDragging) return
      let thisIndex = thisGrid.attr('index')
      grids
        .filter(function () {
          return d3.select(this).attr('index') !== thisIndex
        })
        .classed('gridUnhovered', true)
      if (thisGrid.classed('gridUnhovered')) {
        thisGrid.classed('gridUnhovered', false)
      }
      this.updateUpdateSubList({
        path2This: undefined,
        subIds: [Number(thisIndex)],
        type: 'mouseover'
      })
    },
    travelModeUnhoverGrid: function (thisGrid, grids, mode) {
      if (this.isTravelIconDragging) return
      let thisIndex = thisGrid.attr('index')
      if (mode === 'airTravel') {
        if (document.getElementsByClassName('travelIcon').length !== 0) {
          unhoverThisGrid()
        } else {
          unhoverAllGrids()
        }
      } else if (mode === 'groundTravel') {
        unhoverAllGrids()
      }
      this.updateUpdateSubList({
        path2This: null,
        type: 'mouseout'
      })

      function unhoverThisGrid () {
        grids
          .filter(function () {
            return d3.select(this).attr('index') === thisIndex
          })
          .classed('gridUnhovered', true)
      }

      function unhoverAllGrids () {
        grids
          .filter(function () {
            return d3.select(this).attr('index') !== thisIndex
          })
          .classed('gridUnhovered', false)
      }
    },
    drawTravelIcon: function (thisGrid) {
      let travelIconCoords = this.getTranslate(thisGrid)
      let travelIconG
      travelIconG = this.d3el.select('.SubMapTiling')
        .append('g')
        .attr('class', 'travelIcon')
        .attr('transform', `translate(${travelIconCoords})scale(${this.travelIconScale})`)
        .style('opacity', 0)
      travelIconG.append('path')
        .attr('d', this.travelIcon)
      let gSize = travelIconG.node().getBoundingClientRect()
      let mapSvgTransform = getTransformation(d3.select('#mapSvg').attr('transform'))
      let scaleX = mapSvgTransform.scaleX
      let scaleY = mapSvgTransform.scaleY
      if (this.d3el.select('.SubMapTiling').attr('transform') !== null) {
        let subMapTilingTransform = getTransformation(this.d3el.select('.SubMapTiling').attr('transform'))
        scaleX *= subMapTilingTransform.scaleX
        scaleY *= subMapTilingTransform.scaleY
      }
      travelIconG
        .attr('transform', `translate(${[
          travelIconCoords[0] - gSize.width * 2 / 3 / scaleX,
          travelIconCoords[1] - gSize.height / scaleY
        ]})scale(${this.travelIconScale})`)
        .style('opacity', 1)
      this.travelIconSizeDiff = {
        width: gSize.width * 2 / 3 / scaleX,
        height: gSize.height / scaleY
      }
    },
    fadeIrrelevantRoutesAndCaps: function (highlightLandRouteCoords, travelRouteOD) {
      let odPairs = []
      for (let i = 0; i < travelRouteOD.length - 1; i++) {
        odPairs.push(String([travelRouteOD[i], travelRouteOD[i + 1]]))
        odPairs.push(String([travelRouteOD[i + 1], travelRouteOD[i]]))
      }
      
      this.Route.drawHighlightLandRoute(this.d3el.select('.SubMapTiling'), highlightLandRouteCoords)
      // raise cap and travel icon and then show the highlight route
      this.d3el.select('.SubMapTiling').selectAll('.mapCaps').raise()
      this.d3el.select('.SubMapTiling').select('.travelIcon').raise()
      this.Route.showHighlightLandRoute(this.d3el.select('.SubMapTiling'))
      this.d3el.select('.SubMapTiling').selectAll('.landRoute')
        // .filter(function () {
        //   let thisOD = d3.select(this).attr('od')
        //   return odPairs.indexOf(thisOD) === -1
        // })
        .classed('routeUnselected', true)
      this.d3el.select('.SubMapTiling').selectAll('.seaRoute')
        .filter(function () {
          let thisOD = d3.select(this).attr('od')
          return odPairs.indexOf(thisOD) === -1
        })
        .classed('routeUnselected', true)
      let mapG  = this.d3el.select('.SubMapTiling').select('.mapCaps')
      mapG.selectAll('.nationalCaps')
        .filter(function () { return travelRouteOD.indexOf(Number(d3.select(this).attr('index'))) === -1 })
        .each(function () {
          d3.select(this).selectAll('circle').each(function (p, idx) {
            if (idx === 0) {
              d3.select(this).style('stroke-opacity', 0.25)
            } else if (idx === 1) {
              d3.select(this).style('fill-opacity', 0.25)
            }
          })
        })
      mapG.selectAll('.provincialCaps')
        .filter(function () { return travelRouteOD.indexOf(Number(d3.select(this).attr('index'))) === -1 })
        .each(function () {
          d3.select(this).select('circle').style('stroke-opacity', 0.25)
        })
    },
    highlightTravelRouteSubs: function (travelRouteSubs) {
      this.d3el.select('.SubMapTiling').selectAll('.SubMapGrids')
        .each(function () {
          let thisGrid = d3.select(this)
          if (travelRouteSubs.indexOf(Number(thisGrid.attr('index'))) > -1) {
            thisGrid.classed('gridClicked', true)
          }
        })
    },
    resetTravelRouteSubs: function () {
      this.d3el.select('.SubMapTiling').selectAll('.SubMapGrids').classed('gridClicked', false)
    },
    unselectRoute: function () {
      this.d3el.select('.SubMapTiling').selectAll('.landRoute').classed('routeUnselected', false)
      this.d3el.select('.SubMapTiling').selectAll('.seaRoute').classed('routeUnselected', false)
      this.d3el.select('.SubMapTiling').selectAll('.hightlightLandRoute').remove()
    },
    cancelSubMapClustersEventBinding: function () {
      const self = this
      if (this.subMapClustersEvent === null) {
        let events = ['mouseover', 'mouseout', 'click', 'dblclick']
        this.subMapClustersEvent = {}
        for (let i = 0; i < events.length; i++) {
          this.subMapClustersEvent[events[i]] = {}
        }
        this.d3el.select('.SubMapTiling')
          .selectAll('.SubMapClusters').each(function () {
            for (let i = 0; i < events.length; i++) {
              self.subMapClustersEvent[events[i]][d3.select(this).attr('clsID')] = d3.select(this).on(`${events[i]}`)
            }
          })
      }
      this.d3el.select('.SubMapTiling')
        .selectAll('.SubMapClusters')
        .on('mouseover', null)
        .on('mouseout', null)
        .on('click', null)
        .on('dblclick', null)
    },
    bindSubMapClustersEvent: function () {
      const interactions = this.interactions
      const self = this
      let events = ['mouseover', 'mouseout', 'click', 'dblclick']
      this.d3el.select('.SubMapTiling')
        .selectAll('.SubMapClusters')
        .each(function () {
          let thisClsID = d3.select(this).attr('clsID')
          for (let i = 0; i < events.length; i++) {
            d3.select(this).on(`${events[i]}`, self.subMapClustersEvent[`${events[i]}`][thisClsID])
          }
        })
    },
    recoverElemOrder: function () {
      this.d3el.select('.SubMapTiling').selectAll('.SubMapClusters').raise()
      this.d3el.select('.SubMapTiling').selectAll('.mapLandRoute').raise()
      this.d3el.select('.SubMapTiling').selectAll('.mapCaps').raise()
    },
    changeElemOrder: function () {
      this.d3el.select('.SubMapTiling').selectAll('.SubMapGrids').raise()
      this.d3el.select('.SubMapTiling').selectAll('.mapLandRoute').raise()
      this.d3el.select('.SubMapTiling').selectAll('.mapCaps').raise()
    },
    updateView: function (coord, sub) {
      this.resetSubList()
      this.d3el.select('.SubMapTiling').select('.travelIcon')
        .attr('transform', `translate(${[
          coord.x - this.travelIconSizeDiff.width,
          coord.y - this.travelIconSizeDiff.height
        ]})scale(${this.travelIconScale})`)
      this.updateUpdateSubList({
        path2This: undefined,
        subIds: [Number(sub)],
        type: 'mouseover'
      })
    },
    resetSubList: function () {
      d3.select('#subList').select('#subListSvg').selectAll('.listItemG').each(function () {
        let item = d3.select(this)
        if (!item.classed('listItemClicked')) {
          item.classed('listItemHovered', false)
          item.classed('listItemHoverDisabled', false)
          item.select('.subSelected').style('opacity', 0)
        }
      })
    },
    resetCapsOpacity: function () {
      let mapG  = this.d3el.select('.SubMapTiling').select('.mapCaps')
      mapG.selectAll('.nationalCaps')
        .each(function () {
          d3.select(this).selectAll('circle').each(function (p, idx) {
            if (idx === 0) {
              d3.select(this).style('stroke-opacity', 1)
            } else if (idx === 1) {
              d3.select(this).style('fill-opacity', 1)
            }
          })
        })
      mapG.selectAll('.provincialCaps')
        .each(function () {
          d3.select(this).select('circle').style('stroke-opacity', 1)
        })
    }
  }
}

// basic
let bTimer = {}

function bScale (v_scales, v_data) {
  return [v_scales.x(v_data[0]), v_scales.y(v_data[1])]
}

function bTimerObj (v_name, v_time, v_func) {
  return {
    start: new Date(),
    past: 0,
    duration: v_time,
    func: v_func,
    finished: false,
    timer: setTimeout(() => {
      v_func()
      bTimer[v_name] = null
    }, v_time)
  }
}

function bDelay (v_name, v_time, v_func) {
  let t_timeObj = bTimer[v_name]
  if (t_timeObj == null) {
    bTimer[v_name] = bTimerObj(v_name, v_time, v_func)
  } else {
    if (t_timeObj.finished) {
      clearTimeout(t_timeObj.timer)
      t_timeObj = null
    }
    let t_obj = bTimer[v_name]
    t_obj.past = new Date() - t_obj.start
    if (t_obj.past >= t_obj.duration) {
      v_func()
      t_obj.finished = true
      clearTimeout(t_obj.timer)
      bTimer[v_name] = null
    } else {
      t_obj.start = new Date()
      t_obj.func = v_func
    }
  }
}

function bClearDelay (v_name) {
  let t_timeObj = bTimer[v_name]
  if (t_timeObj != null) {
    clearTimeout(t_timeObj.timer)
    t_timeObj = null
  }
}

function bGetMeanVector (v_arr, v_isColVec) {
  let t_arr = v_isColVec ? v_arr : numeric.transpose(v_arr),
    t_dim = numeric.dim(t_arr),
    t_mean = new Array(t_dim[0]),
    t_num = t_dim[1]
  for (let i = 0; i < t_arr.length; i++) {
    t_mean[i] = numeric.sum(t_arr[i]) / t_num
  }
  return t_mean
}

function bGetDistance (v_a, v_b) {
  return numeric.norm2(numeric.sub(v_a, v_b))
}

// basicView
function bvShowOnTop (v_target, v_container) {
  $(v_container).append($(v_target))
}
</script>

<style lang="less">
@height: 100%;
@width: 100%;
@map-height: 100%;
@map-width: 100%;
@panel-height: 100%;
@panel-width: 100% - @map-width;

@Pointer: pointer;
@FillDark: #000;
@FillDeep: #666;
@FillMedian: #999;
@FillLight: #ccc;
@StrokeThick: 2.5px;
@StrokeThin: 1.5px;

#subMap {
  height: @height;
  width: @width;
}

#map {
  height: @map-height;
  width: @map-width;
}

// #mapPanelContainer {
//   position: absolute;
//   left: @map-width;
//   top: 0px;
//   height: @panel-height;
//   width: @panel-width;
// }

.SubMapTilingFrame {
  fill: white;
  visibility: hidden;
}

.SubMapModel circle{
	//fill: @FillDeep;
	opacity: 0.3;
	stroke: none;
	cursor: @Pointer;
}

.SubMapGrid path.ring{
	fill: @FillMedian;
	stroke: none;
	cursor: @Pointer;
}

.SubMapGrid path.cell{
	fill: @FillLight;
	stroke: none;
	cursor: @Pointer;
}

.SubMapGrid circle, .SubMapGrid path.frame{
	stroke: @FillDeep;
	stroke-width: @StrokeThick;
	fill: none;
	cursor: @Pointer;
}

.SubMapGrid path.frame.light{
	stroke:@FillLight;
	stroke-width: 0.8;
}

.SubMapGrid line.weights{
	stroke: @FillDeep;
	stroke-width: @StrokeThin;
	fill: none;
	cursor: @Pointer;
}

.SubMapTriangles path{
	stroke: @FillDeep;
	stroke-width: @StrokeThin;
	fill: none;
}

.SubMapTestCols circle{
	stroke: none;
	fill: @FillDeep;
}

.SubMapGrids{
	cursor: pointer;
}

.SubMapGrids.empty{
	cursor: move;
	opacity: 0.0;
}

.SubMapGrids.empty path{
	stroke: none;
	opacity: 0.2;
}

.SubMapGrids.gridUnhovered {
  opacity: 0.2;
}

.SubMapGrids.travelUnselected {
  opacity: 0.2;
}

.SubMapGrids.gridClicked {
  opacity: 1 !important;
}

.SubMapGrids.pinned path{
	stroke: #000;
	stroke-width: 0.6px;
}

.SubMapGrids line, .SubOldGrids line{
	stroke: #000;
	stroke-linecap: round;
	opacity: 0.5;
}

.empty.SubMapGrids line{
	stroke: #555;
	stroke-width: 0.5;
	opacity: 0.1;
}

.SubMapGrids path.frame, .SubOldGrids path.frame{
	fill: none;
}

.subGlyph{
	fill: @FillDeep;
	stroke: @FillDeep;
}

.subGlyph.empty{
	fill: none;
	stroke: @FillDeep;
}

.subEdge path{
	stroke: none;
}

.subEdge line{
	stroke: @FillDeep;
}

.SubMapDim path.frame{
	stroke:@FillLight;
	stroke-width: @StrokeThin;
	fill: none;
}

.SubMapDim path.bar{
	stroke:@FillDeep;
	stroke-width: @StrokeThin;
	fill: @FillMedian;
}

.SubMapDim.active path.bar{
	stroke-width: @StrokeThick;
}

.SubMapDim{
	cursor: pointer;
	opacity: 0.6;
}

.SubMapDim.active, .SubMapDim:hover{
	opacity: 1.0;
}

.SubMapDim circle{
	stroke: @FillLight;
	stroke-width: @StrokeThin;
	cursor: pointer;
}

.SubMapDim circle.On{
	fill: @FillMedian;
}

.SubMapDim circle.Off{
	fill: #fff;
}

.SubMapDim circle.active{
	stroke: @FillDeep;
	stroke-width: @StrokeThick;
}

.SubMapClusters line{
	stroke-width: @StrokeThin;
	stroke-linecap: round;
}

.SubMapClusters.pinned line{
	stroke-width: @StrokeThick;
}

.SubMapClusters line.chosen{
	stroke-width: @StrokeThick;
}

.SubMapClusters.Outliers path{
	stroke: none;
}

.SubMapClusters path{
	fill: rgb(255,255,255);
	stroke: none;
	cursor: pointer;
	stroke-linecap: round;
}

.SubMapClusters.Outliers path{
	stroke: none;
}

.dimFan{
	display: none;
}

.dimFan.visible{
	display: block
}

.SubMapClusters{
	display: none;
}

.SubMapClusters.visible{
	display: block;
}

.SubMapSShotRing{
	fill: none;
	stroke: @FillMedian;
	stroke-width: @StrokeThick;
}

.SubMapSShot{
	stroke: @FillMedian;
	stroke-width: @StrokeThin;
}

.SubMapSShot .SubMapSSAnchor{
	stroke: none;
	fill: @FillMedian;
}

.SubMapSShot.chosen .SubMapSSAnchor{
	fill: @FillDark;
}

.SubMapSShot .SubMapSnapshot{
	cursor: pointer;
	stroke: @FillMedian;
	stroke-width: @StrokeThin;
}

.SubMapSShot.chosen .SubMapSnapshot{
	stroke: @FillDark;
	stroke-width: @StrokeThick;
}

.SubMapTiling .landRoute,
.SubMapTiling .hightlightLandRoute {
  fill: none;
  stroke: rgb(90, 90, 90);
  stroke-width: @StrokeThin;
}

.SubMapTiling .seaRoute {
  fill: none;
  stroke: rgb(90, 90, 90);
  stroke-width: @StrokeThin * 0.67;
  stroke-dasharray: 4;
  stroke-dashoffset: 4;
}

.SubMapTiling .routeUnselected {
  stroke-opacity: 0.25;
}

.SubMapTiling .mapCaps {
  cursor: pointer;
}

.SubMapTiling .travelIcon path {
  fill: rgb(96, 148, 239);
}
</style>
