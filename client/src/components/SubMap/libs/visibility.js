const numeric = require('numeric')

class Visibility {
  constructor (parent, center, ringDiameter, glyphSize, clusterLevel, colors, duration, updateChangeLevelByMap) {
    this.zoomScale = 1
    let extent = [1, Math.sqrt(clusterLevel) + 1]
    let maxLevel = Math.log(Math.pow(extent[1], 4)) / Math.log(2)
    let zoomer = d3.zoom()
      // no longer in d3 v4 - zoom initialises with zoomIdentity, so it's already at origin
      // .translate([0, 0])
      // .scale(1)
      .scaleExtent(extent)
      .on('zoom', e => {
        let translate = [d3.event.transform.x, d3.event.transform.y]
        let scale = d3.event.transform.k
        this.zoomScale = scale
        d3.select('.SubMapTiling').attr('transform', d3.event.transform)
        this.update(translate, scale)
      })
    this.roundView = false
    this.center = center
    this.diameter = ringDiameter
    this.glyphSize = glyphSize
    this.clsLevel = clusterLevel
    this.colors = colors
    this.parent = parent
    this.zoom = {
      extent: extent,
      maxLevel: maxLevel,
      zoomer: zoomer
    }
    this.duration = duration
    this.container = null
    this.ctr = maxLevel / clusterLevel
    this.div = this.ctr * 0.5
    this.clsToScale = clusterLevel => { return Math.pow(Math.pow(2, clusterLevel * this.ctr), 0.25) }
    this.updateChangeLevelByMap = updateChangeLevelByMap
  } // end of constructor of Visible

  // changeVisible:   change the visibility of an element
  changeVisible (selection, visibleFunc, givenOpacity = false) {
    selection.interrupt()
      .transition()
      .duration(this.duration)
      .attr('opacity', function (d, i) {
        let visible = visibleFunc(this)
        if (visible) {
          d3.select(this).classed('visible', true)
          if (givenOpacity) {
            return visible
          } else {
            return 1
          }
        } else {
          d3.select(this).classed('visible', false)
          return 0
        }
      })
      .on('end', () => {
        // ** Do not know why the order of elements will be changed **
        this.parent.d3el.selectAll('.mapLandRoute').raise()
        this.parent.d3el.selectAll('.mapCaps').raise()
        if (document.getElementsByClassName('travelIcon').length !== 0) {
          this.parent.d3el.selectAll('.travelIcon').raise()
        }
      })
  } // end of changeVisible

  pointVisible (position) {
    if (this.roundView) {
      let ringRRatio = this.parent.snapshotPar.ringRRatio
      position[0] = position[0] * this.scale - this.center[0] + this.translate[0]
      position[1] = position[1] * this.scale - this.center[1] + this.translate[1]
      let pr = Math.sqrt(position[0] * position[0] + position[1] * position[1])
      return (pr + this.glyphSize * this.scale <= this.diameter * ringRRatio - 8 * 0.9)
    } else {
      return true
    }
  } // end of pointVisible

  SubClsVisible (clsVisibility, zoomLevel) {
    let clsVisibleFunc = container => {
      let visible
      if (!d3.select(container).classed('Outliers')) {
        let clusterID = d3.select(container).attr('clsID').split('_')
        let baseline = (clusterID.length - 1) * this.ctr
        visible = zoomLevel >= baseline - this.div && zoomLevel < baseline + this.div
        clsVisibility[clusterID.length - 1].atLevel = visible
      } else {
        let baseline = (this.clsLevel - 1) * this.ctr
        visible = zoomLevel < baseline + this.div
      }
      return visible
    } // end of clsVisibleFunc
    let Cls = this.parent.d3el.selectAll('.SubMapClusters')
    let thisObject = this
    this.changeVisible(Cls, clsVisibleFunc)
    this.parent.d3el
      .selectAll('.visible .SubClsPath')
      .each(function (path) {
        let position = d3.select(this).attr('pos').split('_')
        let lineVisible = thisObject.pointVisible(position[0].split(',')) && thisObject.pointVisible(position[1].split(','))
        d3.select(this).attr('display', lineVisible ? 'block' : 'none')
      })
  } // end of SubClsVisible

  MapRouteVisible (zoomLevel) {
    let routeVisibleFunc = container => {
      let baseline = this.clsLevel * this.ctr
      if (zoomLevel >= baseline - this.div && zoomLevel < baseline + this.div) {
        // let originalOpacity = this.parent.pattern ? parseFloat(d3.select(container).attr('ptOpacity')) : 1.0
        let originalOpacity = 1.0
        return !((this.div - Math.abs(zoomLevel - baseline)) / this.div * originalOpacity)
      } else {
        return true
      }
    }
    let route = this.parent.d3el.selectAll('.mapLandRoute')
    this.changeVisible(route, routeVisibleFunc)
  }

  MapCapVisible (zoomLevel) {
    let capVisibleFunc = container => {
      let baseline = this.clsLevel * this.ctr
      if (zoomLevel >= baseline - this.div && zoomLevel < baseline + this.div) {
        // let originalOpacity = this.parent.pattern ? parseFloat(d3.select(container).attr('ptOpacity')) : 1.0
        let originalOpacity = 1.0
        return !((this.div - Math.abs(zoomLevel - baseline)) / this.div * originalOpacity)
      } else {
        return true
      }
    }
    let cap = this.parent.d3el.selectAll('.mapCaps')
    this.changeVisible(cap, capVisibleFunc)
  }

  SubGlyphVisible (zoomLevel) {
    let glyphVisibleFunc = container => {
      let baseline = this.clsLevel * this.ctr
      if (zoomLevel >= baseline - this.div && zoomLevel < baseline + this.div) {
        let originalOpacity = this.parent.pattern ? parseFloat(d3.select(container).attr('ptOpacity')) : 1.0
        return ((this.div - Math.abs(zoomLevel - baseline)) / this.div * originalOpacity)
      } else {
        return false
      }
    } // end of glyphVisibleFunc
    let Cls = this.parent.d3el.selectAll('.dimFan')
    this.changeVisible(Cls, glyphVisibleFunc, true)
  } // end of SubGlyphVisible

  SubGridVisible (clsVisibility, scales) {
    let visible = new Set()
    let thisObject = this
    this.parent.d3el
      .selectAll('.SubMapGrids')
      .classed('visible', false)
      .classed('invisible', true)
      .interrupt()
      .transition()
      .duration(this.duration)
      .attr('opacity', 0)
    let transform = getTransform(this.parent.d3el.select('.SubMapTiling').attr('transform'))
    let colors = this.parent.colors
    let gridFunc = function (grid) {
      let position = d3.select(this).attr('position').split('_')
      if (thisObject.pointVisible(position) && grid.id != null) {
        visible.add(grid.id)
        let globalPosition = bScale(scales, grid.pos)
        let scale = transform.scale
        let trans = transform.translate
        if (transform.scaleFirst) {
          globalPosition[0] =
            globalPosition[0] * scale + trans[0]
          globalPosition[1] =
            globalPosition[1] * scale + trans[1]
        } else {
          globalPosition[0] =
            (globalPosition[0] + trans[0]) * scale
          globalPosition[1] =
            (globalPosition[1] + trans[1]) * scale
        }
        clsVisibility.update(grid.id, colors[grid.id], globalPosition)
      }
      return clsVisibility
    }
    let visibleContainers = this.parent.d3el
      .selectAll('.SubMapGrids')
      .filter(gridFunc)
      .attr('display', 'block')
      .classed('visible', true)
      .classed('invisible', false)
    visibleContainers
      .interrupt()
      .transition()
      .duration(this.duration)
      .attr('opacity', function () {
        let zgOpacity = parseFloat(d3.select(this).attr('zgOpacity'))
        let ftOpacity = parseFloat(d3.select(this).attr('ftOpacity'))
        let ptOpacity = parseFloat(d3.select(this).attr('ptOpacity'))
        zgOpacity = isNaN(zgOpacity) ? 1.0 : zgOpacity
        ftOpacity = isNaN(ftOpacity) ? 1.0 : ftOpacity
        ptOpacity = isNaN(ptOpacity) ? 1.0 : ptOpacity
        return zgOpacity * ftOpacity * ptOpacity
      })
    setTimeout(() => {
      this.parent.d3el
        .selectAll('.SubMapGrids.invisible')
        .attr('display', 'none')
    })

    function getTransform (v_transform) {
      let t_trans = v_transform,
        t_return = {
          scale: 1.0,
          translate: [0, 0],
          scaleFirst: true
        }
      if (t_trans != null && t_trans != '') {
        let t_indScale = t_trans.indexOf('scale'),
          t_indTrans = t_trans.indexOf('translate'),
          t_translate, t_scale,
          t_scaleFirst, t_scaleLength, t_transLength
        t_scaleFirst = t_return.scaleFirst = (t_indScale >= 0 && t_indScale > t_indTrans)
        if (t_indScale < 0) {
          t_scaleLength = 0
          if (t_indTrans < 0) {
            t_transLength = 0
          } else {
            t_transLength = t_trans.length
          }
        } else {
          if (t_indTrans < 0) {
            t_transLength = 0
            t_scaleLength = t_trans.length
          } else {
            if (t_scaleFirst) {
              t_transLength = t_indScale
              t_scaleLength = t_trans.length - t_transLength
            } else {
              t_scaleLength = t_transLength
              t_transLength = t_trans.length - t_scaleLength
            }
          }
        }
        if (t_scaleLength > 0) {
          t_scale = t_trans.slice(t_indScale, t_indScale + t_scaleLength).replace('scale', '').replace('(', '').replace(')', '')
          t_return.scale = parseFloat(t_scale)
        }
        if (t_transLength > 0) {
          t_translate = t_trans.slice(t_indTrans, t_indScale + t_transLength).replace('translate', '').replace('(', '').replace(')', '').split(',')
          t_return.translate[0] = parseFloat(t_translate[0])
          t_return.translate[1] = parseFloat(t_translate[1])
        }
      }
      return t_return
    }
  } // end of SubGridVisible

  initializeVisible () {
    let clsVisibility = this.parent.currClusters.visible
    let clusterPaths = this.parent.currClusters.paths
    let parent = this.parent
    if (clsVisibility == null) {
      clsVisibility = this.parent.currClusters.visible = []
      clsVisibility.dictionary = new Map()
      let paths = this.parent.currClusters.paths
      for (let i = 0; i < paths.length; i++) {
        let zoomLevelPaths = paths[i]
        let zoomLevelVisible = []
        zoomLevelVisible.atLevel = false
        for (let j = 0; j < zoomLevelPaths.length; j++) {
          let outlier = zoomLevelPaths[j].outlier
          if (!outlier) {
            let ids = zoomLevelPaths[j].ids
            for (let k = 0; k < ids.length; k++) {
              zoomLevelVisible.push({
                index: [j, k],
                clsID: [...zoomLevelPaths[j].previous, k].join('_'),
                visible: false,
                positions: [],
                colors: [],
                avgPos: null,
                avgCol: bGetMeanVector(bSubArray(this.colors, ids[k], [0, 1, 2]), false),
                SShotAngle: 0
              })
            }
          }
        }
        clsVisibility.push(zoomLevelVisible)
      }
      clsVisibility.update = function (givenID, color, position) {
        let findFunc = d => {
          return d === givenID
        }
        for (let i = 0; i < this.length; i++) {
          if (!this[i].atLevel) {
            continue
          }
          let zoomLevelVisible = this[i]
          let dictionary = this.dictionary
          for (let j = 0; j < zoomLevelVisible.length; j++) {
            let visibleItem = zoomLevelVisible[j]
            let index = visibleItem.index
            let ids = clusterPaths[i][index[0]].ids[index[1]]
            let id = ids.findIndex(findFunc)
            if (id >= 0) {
              visibleItem.visible = true
              visibleItem.positions.push(position)
              visibleItem.colors.push(color)
              dictionary.set(givenID, [i, j])
              break
            }
          }
        }
      } // end of clsVisibility.update
      clsVisibility.updateColors = function (colorsMap) {
        let filterFunc = function () {
          let index = d3.select(this).attr('index')
          let returned = false
          if (colorsMap.has(index)) {
            returned = true
            let color = bGetMeanVector(colorsMap.get(index), false)
            // color = bvColToHcl(color)
            color = bvColToRgb(color)
          }
          return returned
        }
        parent.d3el.selectAll('.SubMapSShot').filter(filterFunc)
      } // end of clsVisibility.updateColors
    } else {
      clsVisibility.dictionary = new Map()
      for (let i = 0; i < clsVisibility.length; i++) {
        let zoomLevelVisible = clsVisibility[i]
        clsVisibility[i].atLevel = false
        for (let j = 0; j < zoomLevelVisible.length; j++) {
          let zoomLevelVisibleItem = zoomLevelVisible[j]
          zoomLevelVisibleItem.visible = false
          zoomLevelVisibleItem.avgPos = null
          zoomLevelVisibleItem.avgCol = null
          zoomLevelVisibleItem.sshotAngle = 0
        }
      }
    }
    return clsVisibility
  } // end of initializeVisible

  SubSnapshotVisible (clsVisibility) {
    let center = this.center
    let angleIntervel = 180 / this.parent.snapshotPar.angInterval
    for (let i = 0; i < clsVisibility.length; i++) {
      let zoomLevelVisible = clsVisibility[i]
      for (let j = 0; j < zoomLevelVisible.length; j++) {
        let zoomLevelVisibleItem = zoomLevelVisible[j]
        if (zoomLevelVisibleItem.positions.length > 0) {
          let averagePosition = (zoomLevelVisibleItem.avgPos = bGetMeanVector(zoomLevelVisibleItem.positions, false))
          let angle = bGetAngle(center, averagePosition)
          angle = Math.round(angle / Math.PI * angleIntervel) * Math.PI / angleIntervel
          zoomLevelVisibleItem.positions = []
          zoomLevelVisibleItem.SShotAngle = angle
        }
        if (zoomLevelVisibleItem.colors.length > 0) {
          zoomLevelVisibleItem.avgCol = bGetMeanVector(
            zoomLevelVisibleItem.colors,
            false
          )
          zoomLevelVisibleItem.colors = []
        }
      }
    }
  } // end of SubSnapshotVisible

  update (translate, scale, duration) {
    const self = this
    let zoomLevel = Math.log(Math.pow(scale, 4)) / Math.log(2)
    let clsVisibility = this.initializeVisible()
    this.scale = scale
    this.translate = translate
    this.MapCapVisible(zoomLevel)
    this.MapRouteVisible(zoomLevel)
    this.SubClsVisible(clsVisibility, zoomLevel)
    let currLevel
    for (let i = 0; i < clsVisibility.length; i++) {
      if (clsVisibility[i].atLevel === true) {
        currLevel = i
      }
    }
    this.updateChangeLevelByMap({
      level: currLevel
    })
    if (currLevel === 1) { // provincial level
      d3.selectAll('.SubMapGrids').filter(function () {
        let leaves = []
        for (let i = 0; i < Data.subtree.children.length; i++) {
          leaves.push(...JSON.parse(JSON.stringify(Data.subtree.children[i].leaves)))
        }
        return leaves.indexOf(Number(d3.select(this).attr('index'))) !== -1
      }).each(function () {
        d3.select(this).select('.cell')
          .transition()
          .duration(self.duration)
          .style('stroke', '#ccc')
          .style('stroke-width', '0.025rem')
          .style('stroke-linecap', 'round')
      })
    } else {
      d3.selectAll('.SubMapGrids').filter(function () {
        let leaves = []
        for (let i = 0; i < Data.subtree.children.length; i++) {
          leaves.push(...JSON.parse(JSON.stringify(Data.subtree.children[i].leaves)))
        }
        return leaves.indexOf(Number(d3.select(this).attr('index'))) !== -1
      }).each(function () {
        d3.select(this).select('.cell')
          .transition()
          .duration(self.duration)
          .style('stroke', '#ccc')
          .style('stroke-width', '0px')
          .style('stroke-linecap', 'round')
      })
    }
    this.SubGlyphVisible(zoomLevel)
    this.SubGridVisible(clsVisibility, this.parent.scales)
    this.SubSnapshotVisible(clsVisibility)
    this.parent.updateClusterInfo(false)
  } // end of update

  toLevel (self, center, zoomLevel, duration) {
    let zoomScale = this.clsToScale(zoomLevel)
    // let trans = [-center[0] * zoomScale, -center[1] * zoomScale]
    let trans = [-center[0], -center[1]]
    let zoomer = this.zoom.zoomer

    let transform = d3.zoomIdentity
      // .translate(0, 0)
      .translate(trans[0], trans[1])
      .scale(zoomScale)

    d3.select(self).transition().duration(this.duration).call(zoomer.transform, transform)

    let oldScale = this.zoomScale
    if (zoomScale > oldScale) {
      this.update(trans, zoomScale, this.duration)
    } else {
      setTimeout(() => {
        this.update(trans, zoomScale, this.duration)
      }, this.duration)
    }
  }

  prepareContainer (container) {
    let returned = (this.container = container
      .append('g')
      // .call(this.zoom.zoomer)
      // .on('dblclick.zoom', null)
      .append('g')
      .attr('class', 'SubMapTiling'))
      .call(this.zoom.zoomer)
      .on('dblclick.zoom', null)
    return returned
  } // end of prepareContainer
}

let exportClass = () => {
  return (...params) => {
    return new Visibility(...params)
  }
}

export default exportClass()

// basic
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

function bScale (v_scales, v_data) {
  return [v_scales.x(v_data[0]), v_scales.y(v_data[1])]
}

function bSubArray (v_arr, v_row_indeces, v_col_indeces) {
  let t_arr = new Array(v_row_indeces.length)
  for (let i = 0; i < t_arr.length; i++) {
    t_arr[i] = new Array(v_col_indeces.length)
  }
  for (let i = 0; i < v_row_indeces.length; i++) {
    let t_i = v_row_indeces[i]
    for (let j = 0; j < v_col_indeces.length; j++) {
      let t_j = v_col_indeces[j]
      t_arr[i][j] = v_arr[t_i][t_j]
    }
  }
  return t_arr
}

function bGetAngle (v_start, v_end) {
  let t_dx = v_end[0] - v_start[0],
    t_dy = v_end[1] - v_start[1],
    t_PI = Math.PI,
    t_tolerance = Number.EPSILON * 100,
    t_angle
  if (Math.abs(t_dx) < t_tolerance) {
    if (Math.abs(t_dy) > t_tolerance) {
      t_angle = (t_dy > 0 ? 1 : (-1)) * t_PI * 0.5
    }
  } else {
    t_angle = Math.atan(t_dy / t_dx)
    if (t_dx < 0) {
      t_angle += t_PI
    }
  }
  return t_angle
}

// basicView
function bvColToHcl (v_colArr) {
  const color = {
    h: d3.scaleLinear().domain([0, 1]).range([0, 360]),
    c: d3.scaleLinear().domain([0, 1]).range([30, 80]),
    l: d3.scaleLinear().domain([0, 1]).range([150 * 0.3, 150 * 0.6]) // d3 l range[0, 150]
  }
  let t_col = [
    color.h(v_colArr[0]),
    color.c(v_colArr[1]),
    color.l(v_colArr[2])
  ]
  // let t_col = [~~(255 * v_colArr[0]), ~~(255 * v_colArr[1]), ~~(255 * v_colArr[2])]
  return d3.hcl(...t_col)
}

function bvColToRgb (v_colArr) {
  let t_col = [~~(255 * v_colArr[0]), ~~(255 * v_colArr[1]), ~~(255 * v_colArr[2])]
  return 'rgb(' + t_col + ')'
}