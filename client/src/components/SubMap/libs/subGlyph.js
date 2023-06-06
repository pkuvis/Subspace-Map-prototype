class SubGlyph {
  constructor (v_r, v_maxR, v_mapType, v_glyphType, v_colors) {
    let t_init = {
      r: v_r * 2 * Math.sqrt(3) / 3,
      maxR: v_maxR,
      mapType: v_mapType,
      glyphType: v_glyphType,
      strokeThin: 0,
      strokeThick: 4,
      fanAngleRatio: 0.3,
      colors: v_colors,
      filterer: null,
      filterSettings: {
        container: null,
        overallSelector: '.SubMapGrids',
        overallKey: 'index',
        controlAttr: 'opacity',
        invisibleOpac: 0.2,
        static: {
          attrs: ['class'],
          match: ['pinned'],
          miss: [null],
          normal: [false]
        },
        overallFilterFunc: null,
        getFilterFunc: () => {},
        animation: () => {}
      }
    }
    Object.assign(this, t_init)
  }

  getRectGlyph (v_options) {
    class rectGlyph {
      constructor (v_options) {
        let t_dimLength = v_options.dimLength,
          [t_width, t_height] = v_options.size
        this.size = [t_width, t_height]
        this.className = v_options.className
        this.glyphWidth = t_width * 0.8 / (t_dimLength + (t_dimLength + 1) * 0.125)
        this.glyphHeight = t_height * 0.8
        this.glyphSize = Math.min(this.glyphWidth, this.glyphHeight)
        this.margin = v_options.margin
        this.marginWidth = (t_width - t_dimLength * this.glyphWidth - this.margin[0] * 2) / (t_dimLength + 1)
        this.marginHeight = (t_height - this.glyphHeight) / 2
        this.type = v_options.type
      };
      show (v_g, v_dims) {
        let t_glyphSize = this.glyphSize,
          t_glyphWidth = this.glyphWidth,
          t_glyphHeight = this.glyphHeight,
          t_glyphMargin = this.margin,
          t_glyphMarginHeight = this.marginHeight,
          t_marginWidth = this.marginWidth,
          t_type = this.type
        v_g
          .selectAll('.' + this.className)
          .data(v_dims)
          .enter()
          .append('g')
          .attr('class', this.className)
          .attr('transform', (v_dim, v_i) => {
            return 'translate(' + [t_glyphMargin[0] + (t_glyphWidth + t_marginWidth) * v_i + t_marginWidth, this.margin[1] + this.marginHeight] + ')'
          })
          .each(function (v_dim) {
            switch (t_type) {
              case 'rectangle':
                d3.select(this)
                  .classed('empty', v_dim == 0)
                  .append('rect')
                  .attr('x', 0)
                  .attr('y', 0)
                  .attr('width', t_glyphWidth)
                  .attr('height', t_glyphHeight)
                break
              case 'circle':
                let t_r = t_glyphSize / 2
                d3.select(this)
                  .classed('empty', v_dim == 0)
                  .append('circle')
                  .attr('cx', t_r)
                  .attr('cy', t_r)
                  .attr('r', t_r)
                break
            }
          })
      };
    };
    return new rectGlyph(v_options)
  }

  showFrames (vv_g, vv_path, vv_col, vv_opa) {
    vv_g.append('path')
      .classed('metaGlyph', true)
      .classed('fill', true)
      .attr('d', vv_path)
      .attr('fill', vv_col)
      .attr('fill-opacity', vv_opa)
      .classed('cell', true)
  }

  showBoundaries (vv_g, vv_nghDist, vv_r, vv_empty) {
    vv_g.selectAll('line')
      .data(vv_nghDist)
      .enter()
      .append('g')
      .attr('class', 'gridEdge')
      .attr('transform', v_ngh => {
        return 'rotate(' + (v_ngh.angle / Math.PI * 180) + ')'
      })
      .append('line')
      .attr('x1', vv_r * Math.sqrt(3) / 2)
      .attr('x2', vv_r * Math.sqrt(3) / 2)
      .attr('y1', vv_r * 0.5)
      .attr('y2', -vv_r * 0.5)
      .attr('opacity', v_ngh => {
        if (v_ngh.dist == null) {
          if (vv_empty) {
            return 0.2
          } else {
            return 1.0
          }
        } else {
          return (v_ngh.dist)
              // return 1.0;
        }
      })
      .attr('stroke', 'none')
      .attr('stroke-width', v_ngh => {
        if (v_ngh.dist == null) {
          if (vv_empty) {
            return this.strokeThin + 'px'
          } else {
            return '0px' // this.strokeThick;
          }
        } else {
          return v_ngh.dist * 0.9 * this.strokeThick + 'px'
        }
      })
  }

  showStick (vv_g, vv_dims) {
    let t_div = Math.PI * 2 / vv_dims.length
    for (let i = 0; i < vv_dims.length; i++) {
      let tt_ang = t_div * i
      vv_g.append('line')
        .attr('class', 'weights')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', this.maxR * 0.8 * vv_dims[i] * Math.cos(tt_ang))
        .attr('y2', this.maxR * 0.8 * vv_dims[i] * Math.sin(tt_ang))
    }
  }

  showFan (vv_g, vv_dims, vv_id, vv_col, v_capR, v_inR, v_outR, v_pattern = false, v_weights = null, v_ext = null) {
    let t_div = Math.PI * 2 / vv_dims.length,
      t_this = this,
      t_nationalcap = Data.nationalCaps.indexOf(vv_id) !== -1,
      t_provincialCap = Data.provincialCaps.indexOf(vv_id) !== -1,
      t_dimArc = d3.arc()
        .outerRadius(v_outR)
        .innerRadius(v_inR)
        .startAngle(-t_div * this.fanAngleRatio)
        .endAngle(t_div * this.fanAngleRatio),
      t_capDimArc = d3.arc()
        .outerRadius(v_outR)
        .innerRadius(v_capR)
        .startAngle(-t_div * this.fanAngleRatio)
        .endAngle(t_div * this.fanAngleRatio)
    for (let i = 0; i < vv_dims.length; i++) {
      let tt_ang = 360 / vv_dims.length * i
      vv_g.append('g')
        .attr('class', 'dimFan')
        .classed('metaGlyph', true)
        .attr('transform', 'rotate(' + tt_ang + ')')
        .attr('index', vv_id + '_' + i)
        .attr('ptOpacity', function () {
          if (!v_pattern) {
            return 1
          } else {
            // test here
            let score = (v_weights[i] - v_ext.min) / (v_ext.max - v_ext.min)
            score = score * 20 - 10
            score = 1 / (Math.exp(-score) + 1)
            return 0.9 * score
          }
        })
        // opacity显示data stability
        .attr('opacity', () => {
          if (!v_pattern) {
            return 1
          } else {
            let score = (v_weights[i] - v_ext.min) / (v_ext.max - v_ext.min)
            // score = score * 20 - 10
            // score = 1 / (Math.exp(-score) + 1)
            return score
          }
        })
        .append('path')
        .classed('fill', (vv_dims[i] != 0))
        // .attr('d', t_dimArc())
        .attr('d', () => t_nationalcap ? t_capDimArc() : t_provincialCap ? t_capDimArc() : t_dimArc())
        .attr('fill', (vv_dims[i] == 0) ? 'none' : vv_col)
        // 有这个维度就会有fill
        .attr('stroke', function () {
          let t_empty = !(d3.select(this).classed('fill'))
          return v_pattern ? (t_empty ? vv_col : 'none') : 'none'
        }) // v_weights == null?"none":"#666")
        // 没有维度有stroke
        .attr('stroke-width', function () {
          let t_empty = !(d3.select(this).classed('fill'))
          return v_pattern ? (t_empty ? t_this.strokeThin : '0px') : '0px'
        })
        // .attr("stroke-width", () => {
        //     if(v_weights == null){
        //         return 0;
        //     }else{
        //         return 0.5 + 1 * v_weights[i] / v_ext.max;
        //     }
        // })
    }
    if (t_nationalcap) {
      // vv_g.append('circle')
      //   .attr('cx', 0)
      //   .attr('cy', 0)
      //   .attr('r', v_capR)
      //   .style('fill', '#000')
      vv_g.append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', v_capR)
        .style('fill', '#fff')
        .style('stroke', '#000')
        .style('stroke-width', v_capR / 3)
      vv_g.append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', v_inR)
        .style('fill', '#000')
    }
    if (t_provincialCap) {
      vv_g.append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', v_capR)
        .style('fill', '#fff')
        .style('stroke', '#000')
        .style('stroke-width', v_capR / 2)
    }
  }

  showBridge (vv_g, vv_nghDist, vv_r, vv_col) {
    let t_scale = vv_nghDist.diffScale
    vv_g.selectAll('.subEdge')
      .data(vv_nghDist)
      .enter()
      .append('g')
      .attr('class', 'subEdge')
      .attr('transform', v_ngh => { return 'rotate(' + (v_ngh.angle / Math.PI * 180) + ')' })
      .call(vv_gs => {
        vv_gs[0].forEach(vvv_g => {
          let tt_ngh = d3.select(vvv_g).data()[0],
            tt_isDiff = tt_ngh.diff != null
          if (!tt_isDiff) {
            return
          }
          let tt_length = tt_isDiff ? t_scale(tt_ngh.diff) : null,
            tt_spot1 = [vv_r, -tt_length * 0.5],
            tt_spot2 = [vv_r, tt_length * 0.5],
            tt_triangle = 'M0 0' + ' L' + tt_spot1.join(' ') + ' L' + tt_spot2.join(' ') + ' Z'
          d3.select(vvv_g)
            .attr('opacity', tt_ngh.dist)
            .append('path')
            .attr('d', tt_triangle)
            .attr('fill', vv_col)
          d3.select(vvv_g)
            .append('line')
            .attr('x1', 0)
            .attr('x2', tt_spot1[0])
            .attr('y1', 0)
            .attr('y2', tt_spot1[1])
            .attr('stroke-width', (tt_ngh.dist) * 3)
          d3.select(vvv_g)
            .append('line')
            .attr('x1', 0)
            .attr('x2', tt_spot2[0])
            .attr('y1', 0)
            .attr('y2', tt_spot2[1])
            .attr('stroke-width', (tt_ngh.dist) * 3)
        })
      })
  }

  initializeFilter (v_container) {
    let t_filterer = this.filterer,
      t_filterSettings = this.filterSettings
    if (t_filterer == null) {
      t_filterSettings.container = v_container
      this.filterer = t_filterer = bvFilter(t_filterSettings)
    }
    let t_animateFunc = (v_d3selection, v_fit) => {
      let t_ftOpc = v_fit ? 1 : t_filterSettings.invisibleOpac
      v_d3selection
        .attr('ftOpacity', t_ftOpc)
        .interrupt()
        .transition()
        .attr('opacity', function () {
          let t_this = d3.select(this),
            t_zgOpc = parseFloat(t_this.attr('zgOpacity')),
            t_ptOpc = parseFloat(t_this.attr('ptOpacity'))
          t_zgOpc = isNaN(t_zgOpc) ? 1.0 : t_zgOpc
          t_ptOpc = isNaN(t_ptOpc) ? 1.0 : t_ptOpc
          return t_zgOpc * t_ftOpc * t_ptOpc
        })
    }
    t_filterSettings.getFilterFunc = (dimCover, codeBook) => {
      let allLimits = dimCover.filter((d) => { return d >= 0 })
      let allCount = allLimits.length
      if (allCount === 0) {
        return (gridCell) => { return true }
      } else {
        return (gridCell) => {
          let gridID = gridCell[0].ID
          let code = codeBook[gridID]
          let fitCount = 0
          let fit = true
          for (let i = 0; i < dimCover.length; i++) {
            if (dimCover[i] >= 0 && Number(code[i]) === dimCover[i]) {
              fitCount++
            }
          }
          if (fitCount < allCount) {
            fit = false
          }
          return fit
        }
      }
    }
    t_filterer.animation = t_animateFunc
    t_filterer.init()
  }

  filterGlyphsByDims (container, dimCover, attr, attrFunc, extraInfo) {
    let filterer = this.filterer
    if (filterer == null || !filterer.ready) {
      this.initializeFilter(container)
    }
    let filterResult
    if (dimCover != null && dimCover.needed) {
      filterResult = this.filterer.filter('filterDims', 'data', null, this.filterSettings.getFilterFunc(dimCover, extraInfo), true)
    } else {
      filterResult = this.filterer.restore('filterDims')
    }
    return bvGetFromSelection(filterResult, attr, attrFunc)
  }

  filterGlyphsByIDs (v_container, v_ids, v_attr, v_attrFunc) {
    let t_filterer = this.filterer,
      filterResult
    if (t_filterer == null || !t_filterer.ready) {
      this.initializeFilter(v_container)
      t_filterer = this.filterer
    }
    if (v_ids != null) {
      filterResult = t_filterer.filter('filterIDs', 'index', v_ids)
    } else {
      filterResult = t_filterer.restore('filterIDs')
    }
    return bvGetFromSelection(filterResult, v_attr, v_attrFunc)
  }

  pickGlyphsByIDs (container, ids, attr, attrFunc) {
    let filterer = this.filterer
    let filterResult
    if (filterer == null || !filterer.ready) {
      this.initializeFilter(container)
      filterer = this.filterer
    }
    if (ids != null) {
      filterResult = filterer.pick('pickIDs', 'index', ids)
    } else {
      filterResult = filterer.restore('pickIDs')
    }
    return bvGetFromSelection(filterResult, attr, attrFunc)
  }

  changeGlyph (v_gs, v_pattern, v_weights) {
    let t_this = this,
      t_ext = v_weights.extent
    switch (this.mapType) {
      case 'cell':
        switch (this.glyphType) {
          case 'fill':
            break
          case 'stick':
            break
          case 'fan':
            v_gs.selectAll('.dimFan')
              .attr('ptOpacity', function () {
                let t_index = d3.select(this).attr('index'),
                  t_id, t_dim
                t_index = t_index.split('_')
                t_id = t_index[0]
                t_dim = t_index[1]
                let t_weights = v_weights[t_id]
                if (!v_pattern) {
                  return 1
                } else {
                  // test here
                  let score = (t_weights[t_dim] - t_ext.min) / (t_ext.max - t_ext.min)
                  score = score * 20 - 10
                  score = 1 / (Math.exp(-score) + 1)
                  return 0.9 * score
                  // return 0 + 0.9 * Math.pow(t_weights[t_dim],3) / Math.pow(t_ext.max,3);
                }
              })
              .transition()
              .attr('opacity', function () {
                return d3.select(this).attr('ptOpacity')
              })
            v_gs.selectAll('.dimFan')
              .select('path')
              .transition()
              .attr('stroke', function () {
                  // test here
                  /* let t_empty = !(d3.select(this).classed('fill'))
                  return v_pattern ? (t_empty ? '#000' : 'none') : 'none' */
                return '#000'
              }) // v_weights == null?"none":"#666")
              .attr('stroke-width', function () {
                  // test here
                let t_empty = !(d3.select(this).classed('fill'))
                  /* return v_pattern ? (t_empty ? t_this.strokeThin : '0px') : '0px' */
                return t_empty ? t_this.strokeThin : '0px'
              })
            break
        }
        break
    }
  }

  showGlyph (v_g, v_nghDist, v_id, v_dims, v_col, v_pattern = false, v_weights = null, v_ext = null) {
    let v_isEmpty = (v_id == null),
      t_r = this.r
    if (v_dims && v_dims.length) {
      this.strokeThin = 4 / v_dims.length
      this.strokeThick = 12 / v_dims.length
    } else {
      this.strokeThin = 0.5
      this.strokeThick = 4
    }
    switch (this.mapType) {
      case 'cell':
        switch (this.glyphType) {
          case 'fill':
            this.showFrames(v_g, d3.hexbin().hexagon(t_r), v_col, 0.8)
            // this.showBoundaries(v_g, v_nghDist, t_r, v_isEmpty)
            break
          case 'stick':
            this.showFrames(v_g, d3.hexbin().hexagon(t_r), v_col, 0.8)
            // this.showBoundaries(v_g, v_nghDist, t_r, v_isEmpty)
            if (t_r > 0 && v_dims && v_dims.length > 0) {
              this.showStick(v_g, v_dims)
            }
            break
          case 'fan':
            this.showFrames(v_g, d3.hexbin().hexagon(t_r), (v_id == null) ? '#000' : v_col, (v_id == null) ? 0.2 : 0.4)
            // this.showBoundaries(v_g, v_nghDist, t_r, v_isEmpty)
            if (!v_isEmpty && v_dims && v_dims.length > 0) {
              this.showFan(v_g, v_dims, v_id, '#000', t_r * 0.2, t_r * 0.1, t_r * 0.8, v_pattern, v_weights, v_ext)
            }
            break
        }
        break
      case 'diff':
        this.showFrames(v_g, d3.hexbin().hexagon(t_r), (v_id == null) ? '#fff' : v_col, 0.2)
        // this.showBoundaries(v_g, v_nghDist, t_r, v_isEmpty)
        if (!v_isEmpty) {
          this.showBridge(v_g, v_nghDist, this.maxR, v_col)
        }
        break
    }
    return v_g
  }
}

let exportClass = () => {
  return (...params) => {
    return new SubGlyph(...params)
  }
}

export default exportClass()

// basicView

class PDFilter {// one PDFilter only controls one type of attribute, but allows multiple cross filters
  constructor (v_filterSetting) {
    this.container = v_filterSetting.container
    this.overallSelector = v_filterSetting.overallSelector
    this.overallKey = v_filterSetting.overallKey
    let t_ovlFiltFunc = v_filterSetting.overallFilterFunc
    this.overallFilterFunc = (t_ovlFiltFunc == null) ? (v_d) => {
      return true
    } : t_ovlFiltFunc
    this.subSelector = v_filterSetting.subSelector
    this.controlAttr = v_filterSetting.controlAttr
    this.static = v_filterSetting.static
    this.animation = v_filterSetting.animation
    if (typeof (this.animation) === 'object') {
      let t_duration = this.animation.duration
      this.animation.duration = (t_duration == null) ? t_duration : 400
    }
    this.filterers = new Array()
    this.filterID = 0
    this.ready = false
  };
  init () {
    this.ready = true
    let t_this = this, t_animation = this.animation,
      t_ovlFilter = this.overallFilterFunc,
      t_selection = this.container.selectAll(this.overallSelector).filter(this.overallFilterFunc)
    if (this.subSelector != null) {
      t_selection = t_selection.selectAll(this.subSelector)
    }
    if (typeof (t_animation) === 'function') {
      t_animation(t_selection, true)
    } else {
      if (typeof (t_animation.match) !== 'function') {
        t_animation.match = () => { return t_animation.match }
      }
      if (typeof (t_animation.miss) !== 'function') {
        t_animation.miss = () => { return t_animation.miss }
      }
      t_selection.attr(t_animation.attr, t_animation.match())
    }
    this.filterers.filters = new Array()
    this.filterers.pickers = new Array()
    this.filterers.reducers = new Array()// reducers && ((filters && filters) || (pickers || pickers))
    this.filterers.otherFilters = new Array()
    this.filterers.otherPickers = new Array()
    this.filterers.otherReducers = new Array()
    this.filterers.add = function (v_id, v_attr, v_filterFunc, v_type = 'filter') {
      let t_animation = t_this.animation, t_filterSign = 'PDfiltered_' + v_id + '_' + t_this.filterID,
        t_selection = t_this.container.selectAll(t_this.overallSelector)
          .filter(t_this.overallFilterFunc)
          .classed(t_filterSign, true)
      this.push({
        id: v_id,
        attr: v_attr,
        sign: t_filterSign,
        func: v_filterFunc,
        type: v_type
      })
      switch (v_type) {
        case 'reduce':
          this.reducers.push(t_filterSign)
          break
        case 'filter':
          this.filters.push(t_filterSign)
          break
        case 'pick':
          this.pickers.push(t_filterSign)
          break
      }
      t_this.filterID++
      return t_this.filterID - 1
    }
    this.filterers.findID = function (v_id) {
      return this.findIndex((v_filterer) => { return v_filterer.id == v_id })
    }
    this.filterers.fitFilters = function (v_obj, v_sign, v_selfOnly = false) {
      let t_allFilters = v_selfOnly ? (this.filters) : [...this.filters, ...this.otherFilters], t_fit = true
      for (let i = 0; i < t_allFilters.length; i++) {
        let t_sign_i = t_allFilters[i]
        if (t_sign_i == v_sign) {
          continue
        } else {
          if (!d3.select(v_obj).classed(t_sign_i)) {
            t_fit = false
            break
          }
        }
      }
      if (t_fit) {
        t_fit = this.fitReducers(v_obj, v_sign)
      }
      return t_fit
    }
    this.filterers.fitPickers = function (v_obj, v_sign, v_selfOnly = false) {
      let t_allPickers = v_selfOnly ? (this.pickers) : [...this.pickers, ...this.otherPickers], t_fit = false
      for (let i = 0; i < t_allPickers.length; i++) {
        let t_sign_i = t_allPickers[i]
        if (v_sign != null && v_sign == t_sign_i) {
          continue
        }
        if (d3.select(v_obj).classed(t_sign_i)) {
          t_fit = true
          break
        }
      }
      if (t_fit) {
        let t_newFit = this.fitReducers(v_obj, v_sign)
        if (t_fit != t_newFit) { t_fit = t_newFit }
      }
      return t_fit
    }
    this.filterers.fitReducers = function (v_obj, v_sign, v_selfOnly = false) {
      let t_reducers = v_selfOnly ? (this.reducers) : [...this.reducers, ...this.otherReducers], t_fit = true
      if (t_reducers.length > 0) {
        for (let i = 0; i < t_reducers.length; i++) {
          let t_sign_i = t_reducers[i]
          if (t_sign_i == v_sign) {
            continue
          } else {
            if (!d3.select(v_obj).classed(t_sign_i)) {
              t_fit = false
              break
            }
          }
        }
      }
      return t_fit
    }
    this.filterers.getPickers = function (v_selection, v_sign) {
      let t_filterers = this,
        t_pickSelection = t_this.container
          .selectAll(t_this.overallSelector)
          .filter(t_this.overallFilterFunc)
          .filter(function () {
            return t_filterers.fitPickers(this, v_sign)
          }),
        t_objs = t_pickSelection._groups[0]
      let t_keys = new Set(), t_keyName = t_this.overallKey
      v_selection.each(function () {
        t_keys.add($(this).attr(t_keyName))
      })
      for (let i = 0; i < t_objs.length; i++) {
        let t_key = $(t_objs[i]).attr(t_keyName)
        if (!t_keys.has(t_key)) {
          v_selection._groups[0].push(t_objs[i])
          // v_selection[0].push(t_objs[i])
        }
      }
    }
    this.filterers.restoreOthers = function (v_sign) {
      let t_allSigns = this.filters, t_objs = t_this.container.selectAll(t_this.overallSelector)
                  .filter(t_this.overallFilterFunc).classed(v_sign, true)
      for (let i = 0; i < t_allSigns.length; i++) {
        let t_sign = t_allSigns[i]
        if (t_sign == v_sign) {
          continue
        }
        t_objs = t_objs.filter(function () {
          return d3.select(this).classed(t_sign)
        })
      };
      return t_objs
    }
  };
  setStatic (v_selection, v_match, v_selLength) {
    let t_static = this.static,
      t_filterers = this.filterers,
      t_allSelection = this.container.selectAll(this.overallSelector).filter(this.overallFilterFunc),
      // t_isNormal = (t_allSelection[0].length == v_selLength),
      t_isNormal = (t_allSelection._groups[0].length == v_selLength),
      t_selection = v_selection
    if (t_static != null && !t_selection.empty()) {
      let t_staticAttrs = t_static.attrs, t_matches = t_static.match, t_misses = t_static.miss, t_normals = t_static.normal
      for (let i = 0; i < t_staticAttrs.length; i++) {
        let t_attr = t_staticAttrs[i], t_noSpecial = (t_normals == null ? true : t_normals[i])
        if (t_attr == 'class') {
          let t_match = t_noSpecial ? v_match : (t_isNormal ? false : v_match)
          if (t_matches[i] == 'chosen') {
            if (t_matches[i] != null) {
              t_selection.classed(t_matches[i], t_match)
            }
          }
          if (t_misses[i] != null) {
            t_selection.classed(t_misses[i], !t_match)
          }
        } else {
          let t_normalValue = (v_match ? t_matches[i] : t_misses[i]),
            t_specialValue = (v_match ? t_misses[i] : t_matches[i]),
            t_value = t_noSpecial ? t_normalValue : (t_isNormal ? t_normalValue : t_specialValue)
          t_selection.attr(t_attr, t_value)
        }
      }
    }
  };
  setAnimation (v_selection, v_match) {
    let t_animation = this.animation
    if (typeof (t_animation) === 'function') {
      t_animation(v_selection, v_match)
    } else {
      v_selection
        .interrupt()
        .transition()
        .duration(t_animation.duration)
        .attr(t_animation.attr, v_match ? t_animation.match() : t_animation.miss())
    }
  };
  filterChange (v_id, v_attr, v_values, v_filterFunc, v_reduce = false) {
    let t_filterID = this.filterers.findID(v_id)
    if (t_filterID == -1) {
      t_filterID = this.filterers.add(v_id, v_attr, v_filterFunc, v_reduce ? 'reduce' : 'filter')
    }
    let t_filterers = this.filterers,
      t_filterer = t_filterers[t_filterID],
      t_sign = t_filterer.sign,
      t_oldSign = t_sign + '_old',
      t_animation = this.animation,
      t_conditions = new Set(v_values),
      t_filterFunc = t_filterer.func,
      t_fAttr = t_filterer.attr,
      t_oldSelection = this.container.selectAll(this.overallSelector + '.' + t_sign)
        .filter(this.overallFilterFunc)
        .classed(t_oldSign, true)
        .classed(t_sign, false),
      t_newSelection = this.container.selectAll(this.overallSelector)
        .filter(this.overallFilterFunc)
        .filter(function () {
          let t_attr = d3.select(this).attr(t_fAttr)
          if (t_filterFunc == null) {
            return t_conditions.has(t_attr)
          } else {
            return t_filterFunc(t_attr)
          }
        })
        .filter(function () {
          return t_filterers.fitFilters(this, t_sign)
        })
        .classed(t_sign, true)
    t_filterers.getPickers(t_newSelection)
    let t_falseToTrue = t_newSelection.filter(function () {
        return !d3.select(this).classed(t_oldSign)
      }),
      t_trueToFalse = t_oldSelection.filter(function () {
        return !d3.select(this).classed(t_sign)
      })
    this.container.selectAll('.' + t_oldSign)
          .classed(t_oldSign, false)
    this.setStatic(t_falseToTrue, true, t_falseToTrue[0].length)
    this.setStatic(t_trueToFalse, false, t_trueToFalse[0].length)
    this.setAnimation(t_falseToTrue, true)
    this.setAnimation(t_trueToFalse, false)
    return t_newSelection
  };
  pick (v_id, v_attr, v_values, v_filterFunc) {
    let t_filterID = this.filterers.findID(v_id), t_return
    if (t_filterID == -1) {
      t_filterID = this.filterers.add(v_id, v_attr, v_filterFunc, 'pick')
    }
    let t_filterers = this.filterers,
      t_filterer = t_filterers[t_filterID],
      t_sign = t_filterer.sign,
      t_conditions = new Set(v_values),
      t_filterFunc = t_filterer.func,
      t_fAttr = t_filterer.attr
    if (v_filterFunc != null) {
      t_filterer.func = t_filterFunc = v_filterFunc
    }
    this.restore(v_id, false)
    let t_selection = this.container.selectAll(this.overallSelector)
      .filter(this.overallFilterFunc)
      .filter(function () {
        let t_attr
        if (t_fAttr == 'data') {
          t_attr = d3.select(this).data()
        } else {
          t_attr = d3.select(this).attr(t_fAttr)
        }
        if (t_filterFunc == null) {
          return t_conditions.has(t_attr)
        } else {
          return t_filterFunc(t_attr)
        }
      })
      .filter(function () {
        return t_filterers.fitReducers(this)
      })
      .classed(t_sign, true)
    t_filterers.getPickers(t_selection, t_sign)
    t_return = t_selection
    let t_eleNum = t_selection._groups[0].length
    if (this.subSelector != null) {
      t_selection = t_selection.selectAll(this.subSelector)
    }
    this.setStatic(t_selection, true, t_eleNum)
    this.setAnimation(t_selection, true)
    return t_return
  };
  filter (v_id, v_attr, v_values, v_filterFunc, v_reduce = false) {
    let t_filterID = this.filterers.findID(v_id), t_return
    if (t_filterID == -1) {
      t_filterID = this.filterers.add(v_id, v_attr, v_filterFunc, v_reduce ? 'reduce' : 'filter')
    }
    let t_filterers = this.filterers,
      t_filterer = t_filterers[t_filterID],
      t_sign = t_filterer.sign,
      t_conditions = new Set(v_values),
      t_filterFunc = t_filterer.func,
      t_fAttr = t_filterer.attr
    if (v_filterFunc != null) {
      t_filterer.func = t_filterFunc = v_filterFunc
    }
    this.restore(v_id, false)
    let t_selection = this.container.selectAll(this.overallSelector)
      .filter(this.overallFilterFunc)
      .filter(function () {
        let t_attr
        if (t_fAttr == 'data') {
          t_attr = d3.select(this).data()
        } else {
          t_attr = d3.select(this).attr(t_fAttr)
        }
        if (t_filterFunc == null) {
          return t_conditions.has(t_attr)
        } else {
          let t_fit = t_filterFunc(t_attr)
          return t_fit
        }
      })
      .filter(function () {
        return t_filterers.fitFilters(this, t_sign)
      })
      .classed(t_sign, true)
    t_filterers.getPickers(t_selection)
    t_return = t_selection
    let t_eleNum = t_selection._groups[0].length
    if (this.subSelector != null) {
      t_selection = t_selection.selectAll(this.subSelector)
    }
    this.setStatic(t_selection, true, t_eleNum)
    this.setAnimation(t_selection, true)
    return t_return
  };
  restore (v_id, v_direct = true) {
    let t_filterer = this.filterers.find((v_ft) => { return (v_ft.id == v_id) })
    if (t_filterer == null) {
      return null
    }
    let t_sign = t_filterer.sign,
      t_isPicker = (t_filterer.type == 'pick'),
      t_isReducer = (t_filterer.type == 'reduce'),
      t_filterers = this.filterers, t_selection,
      t_noPickers = true,
      t_allSelection = this.container.selectAll(this.overallSelector).filter(this.overallFilterFunc)
    if (!t_isPicker) {
      t_selection = t_filterers.restoreOthers(t_sign).classed(t_sign, v_direct)
    } else {
      t_selection = t_allSelection.classed(t_sign, false)
    }
    if (!t_isPicker && this.filterers.pickers.length > 0) {
      let t_newSelection = t_selection
              .filter(function () {
                return !(t_filterers.fitPickers(this))
              })
      if (t_newSelection._groups[0].length != t_selection._groups[0].length) {
        t_noPickers = false
        t_selection = t_newSelection
      }
    }
    let t_eleNum = t_selection._groups[0].length,
      t_match = (v_direct ? t_noPickers : false)
    if (t_match) {
      t_selection = t_selection.filter(function () {
        return t_filterers.fitReducers(this)
      })
    }
    if (this.subSelector != null) {
      t_selection = t_selection.selectAll(this.subSelector)
    }
    this.setStatic(t_selection, t_match, t_eleNum)
    this.setAnimation(t_selection, t_match)
    let t_return
    if (v_direct) {
      if (!t_isReducer) {
        t_return = t_allSelection.filter(function () {
          return t_filterers.fitPickers(this) && t_filterers.fitReducers(this)
        })
      } else {
        t_return = t_allSelection
      }
    }
    return t_return
  };
  getOther (v_type) {
    let t_filterer = this.filterers, t_return
    switch (v_type) {
      case 'reduce':
        t_return = t_filterer.otherReducers
        break
      case 'filter':
        t_return = t_filterer.otherFilters
        break
      case 'pick':
        t_return = t_filterer.otherPickers
        break
    }
    return t_return
  };
  get (v_type) {
    let t_filterer = this.filterers, t_return
    switch (v_type) {
      case 'reduce':
        t_return = t_filterer.reducers
        break
      case 'filter':
        t_return = t_filterer.filters
        break
      case 'pick':
        t_return = t_filterer.pickers
        break
    }
    return t_return
  };
  set (v_type, v_values) {
    let t_filterer = this.filterers, t_array
    switch (v_type) {
      case 'reduce':
        t_array = t_filterer.otherReducers
        break
      case 'filter':
        t_array = t_filterer.otherFilters
        break
      case 'pick':
        t_array = t_filterer.otherPickers
        break
    }
    for (let i = 0; i < v_values.length; i++) {
      let t_value = v_values[i]
      if (t_array.indexOf(t_value) < 0) {
        t_array.push(t_value)
      }
    }
  };
}

function bvFilter (v_filterSetting) {
  return new PDFilter(v_filterSetting)
}

function bvGetFromSelection (v_selection, v_attr, v_attrFunc) {
  if (v_selection == null || v_selection.empty()) {
    return null
  }
  let t_values = new Array()
  if (v_attr == null && v_attrFunc == null) {
    return v_selection
  } else {
    if (v_attr != null) {
      v_selection.each(function () {
        t_values.push($(this).attr(v_attr))
      })
    } else {
      if (typeof (v_attrFunc) === 'function') {
        v_selection.each(function (v_d) {
          let t_info = v_attrFunc(this, v_d)
          t_values.push(t_info)
        })
      }
    }
  }
  return t_values
}