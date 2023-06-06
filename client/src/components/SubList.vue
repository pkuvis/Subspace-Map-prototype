<template>
  <div id="subList">
    <div id="list"></div>
    <div id="hist"></div>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
export default {
  name: 'SubList',
  data() {
    return {
      rotateDeg: 25,
      histHeightRatio: 0.2,
      histGHeightRatio: 0.7,
      histGXMarginRatio: 0.03,
      histFilterDimExpandedRatio: 1.35,
      histFilterGHeightRatio: 0.3,
      listItemHeightRatio: 0.01,
      listXMarginRatio: 0.08,
      listXMarginNewRatio: 0.01,
      listTopMarginRatio: 0.02,
      dimRibbonXMarginRatio: 0.025,
      dimRibbonXSpacingRatio: 0.012,
      dimRibbonXNewSpacingRatio: 0.5,
      dimRibbonHeightRatio: 0.7,
      hideDims: [],
      showDims: [],
      animationDuration: 400,
    }
  },
  mounted() {},
  computed: {
    ...mapGetters([
      // 'loadedData',
      'updateMap',
      'updateSubList'
    ])
  },
  watch: {
    // loadedData: function (val, oldVal) {
    //   this.updateParams()
    //   if (oldVal != null) {
    //     this.redraw()
    //   } else {
    //     this.init()
    //     this.draw()
    //   }
    // },
    updateMap: function (val, oldVal) {
      this.updateParams()
      this.map = val.map
      this.leafNodes = Array.from(this.map.allLeaves.values())
      this.subOrder = this.getSubOrder()
      if (oldVal.map != null) {
        this.redraw()
      } else {
        this.init()
        this.draw()
      }
    },
    updateSubList (newVal) {
      switch (newVal.type) {
        case 'mouseover':
          let subs
          if (newVal.path2This !== undefined) {
            subs = this.getSubsByPath(newVal.path2This)
          } else {
            subs = newVal.subIds
          }

          // for (let i = 0; i < subs.length; i++) {
          //   let item = this.listSvg.select(`#listItemG${subs[i]}`)
          //   if (!item.classed('listItemHoverDisabled')) {
          //     item.classed('listItemHovered', true)
          //     item.select('.subSelected').style('opacity', 1)
          //   }
          // }

          let currSubOrder = []
          for (const order of this.subOrder) {
            if (this.currSubs.indexOf(Data.subs[order]) > -1) {
              currSubOrder.push(order)
            }
          }
          let subsIdx = []
          for (const sub of subs) {
            subsIdx.push(currSubOrder.indexOf(sub))
          }
          const firstItemOrder = Math.min(...subsIdx)
          const lastItemOrder = Math.max(...subsIdx)
          const maxItemNumOnScreen = Math.floor(1 / this.listItemHeightRatio)
          if (firstItemOrder !== 0 && lastItemOrder + 1 > maxItemNumOnScreen) {
            const existingItemNum = this.currSubs.length
            const maxScrollNum = existingItemNum - maxItemNumOnScreen
            const scrollNum = firstItemOrder - maxScrollNum > 0 ? maxScrollNum : firstItemOrder
            const scrollHeight = scrollNum * this.listItemHeight
            d3.select(this.$el).select('#list')
              .transition()
              .duration(1500)
              .tween('uniquetweenname', scrollTopTween(scrollHeight))
              .on('end', () => {
                for (let i = 0; i < subs.length; i++) {
                  let item = this.listSvg.select(`#listItemG${subs[i]}`)
                  if (!item.classed('listItemHoverDisabled')) {
                    item.classed('listItemHovered', true)
                    item.select('.subSelected').style('opacity', 1)
                  }
                }
                this.updateView('subSelect')
              })
          } else {
            for (let i = 0; i < subs.length; i++) {
              let item = this.listSvg.select(`#listItemG${subs[i]}`)
              if (!item.classed('listItemHoverDisabled')) {
                item.classed('listItemHovered', true)
                item.select('.subSelected').style('opacity', 1)
              }
            }
            this.updateView('subSelect')
          }

          // this.updateView('subSelect')
          break
        case 'mouseout':
          this.listSvg.selectAll('.listItemG').each(function () {
            let item = d3.select(this)
            if (!item.classed('listItemClicked')) {
                item.classed('listItemHovered', false)
                item.classed('listItemHoverDisabled', false)
                item.select('.subSelected').style('opacity', 0)
              }
          })

          d3.select(this.$el).select('#list')
            .transition()
            .duration(1500)
            .tween('uniquetweenname', scrollTopTween(0))
          
          this.updateView('subUnselect')
          break
        case 'click':
          // subs = this.getSubsByPath(newVal.path2This)
          if (newVal.path2This !== undefined) {
            subs = this.getSubsByPath(newVal.path2This)
          } else {
            subs = newVal.subIds
          }
          this.listSvg.selectAll('.listItemG').each(function () {
            let item = d3.select(this)
            if (item.classed('listItemClicked')) {
              item.classed('listItemClicked', false)
              item.classed('listItemHoverDisabled', true)
              item.select('.subSelected').style('opacity', 0)
            }
          })
          for (let i = 0; i < subs.length; i++) {
            let item = this.listSvg.select(`#listItemG${subs[i]}`)
            if (!item.classed('listItemClicked')) {
              item.classed('listItemHovered', false)
              item.classed('listItemClicked', true)
              item.classed('listItemHoverDisabled', true)
              if (item.selectAll('.subSelected')._groups[0].length === 0) {
                item.select('.subSelected').style('opacity', 1)
              }
            }
          }
          this.updateView('subSelect')
          break
        case 'unclick':
          this.listSvg.selectAll('.listItemG').each(function () {
            let item = d3.select(this)
            if (item.classed('listItemClicked')) {
              item.classed('listItemClicked', false)
              item.classed('listItemHoverDisabled', true)
              item.select('.subSelected').style('opacity', 0)
            }
          })
          this.updateView('subUnselect')
          break
        case 'changeShownItems':
          this.currSubs = []
          let subIds = []
          if (newVal.subIds === undefined) {
            if (newVal.path2This !== undefined) {
              subIds = this.getSubsByPath(newVal.path2This)
            } else {
              this.currSubs = JSON.parse(JSON.stringify(Data.subs))
            }
          } else {
            subIds = newVal.subIds
          }
          for (let i = 0; i < subIds.length; i++) {
            this.currSubs.push(Data.subs[subIds[i]])
          }
          this.updateView('dimClick')
          break
      }

      function scrollTopTween (scrollTop) {
        return function () {
          var i = d3.interpolateNumber(this.scrollTop, scrollTop)
          return function (t) { this.scrollTop = i(t) }
        }
      }
    }
  },
  methods: {
    ...mapActions([
      'updateUpdateMapByDim',
      'updateUpdateMapBySub'
    ]),
    updateParams: function () {
      this.width = this.$el.offsetWidth
      this.height = this.$el.offsetHeight

      if (Data.file === 'Pendigits') {
        d3.select(this.$el).select('#list')
          .style('top', 0.185 * this.height + 'px')
          .style('height', 0.795 * this.height + 'px')
      }

      this.histWidth = parseFloat(d3.select(this.$el).select('#hist').style('width'))
      this.histFakeHeight = parseFloat(d3.select(this.$el).select('#hist').style('height'))
      this.histHeight = ratio2px(this.histHeightRatio, this.height)
      this.histGHeight = ratio2px(this.histGHeightRatio, this.histHeight)
      this.histGXMargin = ratio2px(this.histGXMarginRatio, this.width)
      this.histFilterGY = this.histGHeight
      this.histFilterGHeight = ratio2px(this.histFilterGHeightRatio, this.histHeight)
      this.histFilterItemWidth = (this.histWidth - 2 * this.histGXMargin) / Data.dims.length
      this.histFilterDim1stR = this.histFilterItemWidth / 7
      this.histFilterDimCY = this.histFilterDim1stR
      this.histFilterDim1stCX = this.histFilterDim1stR * 2
      this.histFilterDim2ndCX = this.histFilterDim1stCX + this.histFilterDim1stR * 3
      this.histFilterDim2ndStrokeWidth = this.histFilterDim1stR / 2.5
      this.histFilterDim2ndR = this.histFilterDim1stR - this.histFilterDim2ndStrokeWidth / 2
      this.histFilterDim1stSelectedR = this.histFilterDim1stR * this.histFilterDimExpandedRatio
      this.histFilterDim2ndSelectedStrokeWidth = this.histFilterDim2ndStrokeWidth * this.histFilterDimExpandedRatio
      this.histFilterDim2ndSelectedR = this.histFilterDim1stSelectedR - this.histFilterDim2ndSelectedStrokeWidth / 2
      this.histFilterDimNameX = this.histFilterDim1stR
      this.histFilterDimNameY = this.histFilterDim1stR * 3
      // this.histFilterDimNameY = this.histFilterDim1stR * 4.5

      this.histBarTopMargin = toPX('0.8em') * 1.2
      this.histBarBtmMargin = (this.histFilterDim1stSelectedR - this.histFilterDim1stR) * 2
      this.histBarMaxHeight = ratio2px(this.histGHeightRatio, this.histHeight) - this.histBarBtmMargin
      this.histBarX = this.histFilterDim1stCX
      this.histBarWidth = this.histFilterDim2ndCX - this.histFilterDim1stCX
      this.histBarY = d3.scaleLinear()
        .domain([0, d3.max(Data.subtree.data.dimCounts)])
        .range([this.histBarMaxHeight, this.histBarTopMargin])
      this.histBarXSpacing = this.histFilterItemWidth
      this.histBarNumX = this.histBarX + this.histBarWidth / 2
      this.histBarNumXSpacing = this.histBarXSpacing
      this.histBarNumYSpacing = this.histBarTopMargin - toPX('0.8em') / 2

      this.listWidth = parseFloat(d3.select(this.$el).select('#list').style('width'))
      this.listItemHeight = ratio2px(this.listItemHeightRatio, parseFloat(d3.select(this.$el).select('#list').style('height')))
      this.listHeight = this.listItemHeight * Data.subs.length

      // this.listX = ratio2px(this.listXMarginRatio, this.listWidth)
      // // this.listY = ratio2px(this.listTopMarginRatio, this.height)
      // this.listY = 0
      // this.listItemWidth = this.listWidth - 2 * this.listX
      // this.dimRibbonX = ratio2px(this.dimRibbonXMarginRatio, this.listItemWidth)
      // this.dimRibbonXSpacing = ratio2px(this.dimRibbonXSpacingRatio, this.listItemWidth)
      // this.dimRibbonWidth = (this.listItemWidth - 2 * this.dimRibbonX - (Data.dims.length - 1) * this.dimRibbonXSpacing) / Data.dims.length
      // this.dimRibbonHeight = ratio2px(this.dimRibbonHeightRatio, this.listItemHeight)
      // this.dimRibbonY = (this.listItemHeight - this.dimRibbonHeight) / 2
      // this.highlightRibbonStrokeWidth = (this.listItemHeight - this.dimRibbonHeight) / 2
      // this.highlightRibbonY = this.highlightRibbonStrokeWidth / 2
      // this.highlightRibbonX = this.highlightRibbonStrokeWidth / 2
      // this.highlightRibbonWidth = this.listItemWidth - this.highlightRibbonX * 2
      // this.highlightRibbonHeight = this.listItemHeight - this.highlightRibbonY * 2

      this.dimRibbonXSpacing = this.histFilterItemWidth - ((this.histFilterDim2ndCX + this.histFilterDim2ndR) - (this.histFilterDim1stCX - this.histFilterDim1stR))
      this.listX = this.histGXMargin + this.histFilterDim1stCX - this.histFilterDim1stR - ratio2px(this.listXMarginNewRatio, this.listWidth)
      this.listY = 0
      this.listItemWidth = this.listWidth - 2 * this.listX
      this.dimRibbonX = ratio2px(this.listXMarginNewRatio, this.listWidth)
      this.dimRibbonWidth = this.histFilterDim2ndCX + this.histFilterDim2ndR - (this.histFilterDim1stCX - this.histFilterDim1stR)
      this.dimRibbonHeight = ratio2px(this.dimRibbonHeightRatio, this.listItemHeight)
      this.dimRibbonY = (this.listItemHeight - this.dimRibbonHeight) / 2
      this.highlightRibbonStrokeWidth = (this.listItemHeight - this.dimRibbonHeight) / 2
      this.highlightRibbonY = this.highlightRibbonStrokeWidth / 2
      this.highlightRibbonX = this.highlightRibbonStrokeWidth / 2
      this.highlightRibbonWidth = this.listItemWidth - this.highlightRibbonX * 2
      this.highlightRibbonHeight = this.listItemHeight - this.highlightRibbonY * 2

      // this.dimRibbonXRawSpacing = this.histFilterItemWidth - ((this.histFilterDim2ndCX + this.histFilterDim2ndR) - (this.histFilterDim1stCX - this.histFilterDim1stR))
      // this.dimRibbonXSpacing = this.dimRibbonXNewSpacingRatio * this.dimRibbonXRawSpacing
      // this.dimRibbonXRemainingSpacing = (1 - this.dimRibbonXNewSpacingRatio) * this.dimRibbonXRawSpacing * (Data.dims.length - 1) / Data.dims.length
      // this.listX = this.histGXMargin + this.histFilterDim1stCX - this.histFilterDim1stR - ratio2px(this.listXMarginNewRatio, this.listWidth) - this.dimRibbonXRemainingSpacing / 2
      // this.listY = 0
      // this.listItemWidth = this.listWidth - 2 * this.listX
      // this.dimRibbonX = ratio2px(this.listXMarginNewRatio, this.listWidth)
      // this.dimRibbonWidth = this.histFilterDim2ndCX + this.histFilterDim2ndR - (this.histFilterDim1stCX - this.histFilterDim1stR) + this.dimRibbonXRemainingSpacing
      // this.dimRibbonHeight = ratio2px(this.dimRibbonHeightRatio, this.listItemHeight)
      // this.dimRibbonY = (this.listItemHeight - this.dimRibbonHeight) / 2
      // this.highlightRibbonStrokeWidth = (this.listItemHeight - this.dimRibbonHeight) / 2
      // this.highlightRibbonY = this.highlightRibbonStrokeWidth / 2
      // this.highlightRibbonX = this.highlightRibbonStrokeWidth / 2
      // this.highlightRibbonWidth = this.listItemWidth - this.highlightRibbonX * 2
      // this.highlightRibbonHeight = this.listItemHeight - this.highlightRibbonY * 2

      // this.subOrder = this.getSubOrder()
      
      this.color = {
        h: d3.scaleLinear().domain([0, 1]).range([0, 360]),
        c: d3.scaleLinear().domain([0, 1]).range([30, 80]),
        l: d3.scaleLinear().domain([0, 1]).range([150 * 0.3, 150 * 0.6]) // d3 l range[0, 150]
      }
    },
    init: function () {
      this.currSubs = Data.subs
      this.listSvg = d3.select(this.$el)
        .select('#list')
        .append('svg')
        .attr('width', this.listWidth)
        .attr('height', this.listHeight)
        .append('g')
        .attr('id', 'subListSvg')
        .attr('transform', `translate(${this.listX}, ${this.listY})`)
      this.histSvg = d3.select(this.$el)
        .select('#hist')
        .append('svg')
        .attr('width', this.histWidth)
        // .attr('height', this.histHeight)
        .attr('height', this.histFakeHeight)
        .append('g')
        .attr('id', 'subHistSvg')
        .attr('transform', `translate(${this.histGXMargin}, 0)`)
    },
    redraw: function () {
      this.clear()
      this.init()
      this.draw()
    },
    clear: function () {
      // this.listSvg.selectAll('*').remove()
      // this.histSvg.selectAll('*').remove()
      d3.select(this.$el).select('#list').selectAll('*').remove()
      d3.select(this.$el).select('#hist').selectAll('*').remove()
    },
    draw: function () {
      this.drawList()
      this.drawHist()
      this.targetedModification()
    },
    drawHist: function () {
      const self = this

      this.histG = this.histSvg
        .append('g')
        .attr('id', 'histG')
      this.histG
        .selectAll('.histBar')
        .data(Data.subtree.data.dimCounts)
        .enter()
        .append('rect')
        .attr('class', 'histBar')
        .attr('id', (d, i) => `histBar-${i}`)
        .attr('x', (d, i) => this.histBarX + this.histBarXSpacing * i)
        .attr('y', d => this.histBarY(d))
        .attr('width', this.histBarWidth)
        .attr('height', d => this.histBarY(0) - this.histBarY(d))
      this.histG
        .selectAll('.histDimNum')
        .data(Data.subtree.data.dimCounts)
        .enter()
        .append('text')
        .attr('class', 'histDimNum')
        .attr('x', (d, i) => this.histBarNumX + this.histBarNumXSpacing * i)
        .attr('y', d => this.histBarY(d) - this.histBarNumYSpacing)
        .text(d => d)

      this.histFilterG = this.histSvg.append('g')
        .attr('id', 'histFilterG')
        .attr('transform', `translate(0, ${this.histFilterGY})`)
      this.histFilterG
        .selectAll('.histFilterItemG')
        .data(Data.dims)
        .enter()
        .append('g')
        .attr('class', 'histFilterItemG')
        .attr('id', (d, i) => `histFilterItem-${i}`)
        .attr('transform', (d, i) => `translate(${this.histFilterItemWidth * i}, 0)`)
        .each(function (p, idx) {
          d3.select(this)
            .append('circle')
            .attr('class', 'histFilterDimShow')
            .attr('cx', self.histFilterDim1stCX)
            .attr('cy', self.histFilterDimCY)
            .attr('r', self.histFilterDim1stR)
            .on('click', function () {
              const hideCirce = self.histFilterG.select(`#histFilterItem-${idx}`).select('.histFilterDimHide')
              if (hideCirce.classed('histFilterDimHideClicked')) {
                unclickDimHide(hideCirce)
                self.hideDims.remove(idx)
              }
              const thisCircle = d3.select(this)
              if (thisCircle.classed('histFilterDimShowClicked')) {
                unclickDimShow(thisCircle)
                self.showDims.remove(idx)
              } else {
                clickDimShow(thisCircle)
                self.showDims.push(idx)
              }
              self.updateView('dimClick')
              self.updateMapByDim()
            })
          d3.select(this)
            .append('circle')
            .attr('class', 'histFilterDimHide')
            .attr('cx', self.histFilterDim2ndCX)
            .attr('cy', self.histFilterDimCY)
            .attr('r', self.histFilterDim2ndR)
            .style('stroke', '#bdbdbd')
            .style('stroke-width', self.histFilterDim2ndStrokeWidth)
            .on('click', function () {
              const showCircle = self.histFilterG.select(`#histFilterItem-${idx}`).select('.histFilterDimShow')
              if (showCircle.classed('histFilterDimShowClicked')) {
                unclickDimShow(showCircle)
                self.showDims.remove(idx)
              }
              const thisCircle = d3.select(this)
              if (thisCircle.classed('histFilterDimHideClicked')) {
                unclickDimHide(thisCircle)
                self.hideDims.remove(idx)
              } else {
                clickDimHide(thisCircle)
                self.hideDims.push(idx)
              }
              self.updateView('dimClick')
              self.updateMapByDim()
            })
          d3.select(this)
            .append('text')
            .attr('class', 'histFilterDimName')
            .attr('x', self.histFilterDimNameX)
            .attr('y', self.histFilterDimNameY)
            // .attr('transform', `rotate(${self.rotateDeg})`)
            .text(() => {
              if (p.length > 4) {
                return p.slice(0, 4) + '...'
              } else {
                return p
              }
            })
            .on('mouseover', function () {
              d3.select(this)
                .text(p)
            })
            .on('mouseout', function () {
              d3.select(this)
                .text(() => {
                  if (p.length > 4) {
                    return p.slice(0, 4) + '...'
                  } else {
                    return p
                  }
                })
            })
        })

      // this.histFilterDimNameFontSizeAdjustment()

      this.histSvg.selectAll('.histFilterDimName').attr('transform', `rotate(${this.rotateDeg})`)

      function clickDimShow (circle) {
        circle
          .classed('histFilterDimShowClicked', true)
          .attr('r', self.histFilterDim1stSelectedR)
      }
      function unclickDimShow (circle) {
        circle
          .classed('histFilterDimShowClicked', false)
          .attr('r', self.histFilterDim1stR)
      }
      function clickDimHide (circle) {
        circle
          .classed('histFilterDimHideClicked', true)
          .attr('r', self.histFilterDim2ndSelectedR)
          .style('stroke', '#252525')
          .style('stroke-width', self.histFilterDim2ndSelectedStrokeWidth)
      }
      function unclickDimHide (circle) {
        circle
          .classed('histFilterDimHideClicked', false)
          .attr('r', self.histFilterDim2ndR)
          .style('stroke', '#bdbdbd')
          .style('stroke-width', self.histFilterDim2ndStrokeWidth)
      }
    },
    drawList: function () {
      const self = this

      this.listSvg
        .selectAll('.listItemG')
        .data(this.subOrder)
        .enter()
        .append('g')
        .attr('class', 'listItemG')
        .attr('id', d => `listItemG${d}`)
        .attr('subId', d => d)
        .attr('transform', (d, i) => `translate(0, ${this.listItemHeight * i})`)
        // .attr('transform', (d, i) => `translate(0, ${(this.listItemHeight + 1) * i})`)
        .each(function (p, idx) {
          d3.select(this)
            .append('rect')
            .attr('class', 'subRibbon')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', self.listItemWidth)
            .attr('height', self.listItemHeight)
            .attr('fill', d => {
              const channels = Data.colors[d]
              const color = [
                ~~(255 * channels[0]),
                ~~(255 * channels[1]),
                ~~(255 * channels[2])
              ]
              return `rgb(${color})`
              // return d3.hcl(self.color.h(channels[0]), self.color.c(channels[1]), self.color.l(channels[2]))
            })
          d3.select(this)
            .selectAll('.dimRibbon')
            .data(Data.dims)
            .enter()
            .append('rect')
            .attr('class', 'dimRibbon')
            .attr('x', (d, i) => (self.dimRibbonX + (self.dimRibbonWidth + self.dimRibbonXSpacing) * i))
            .attr('y', self.dimRibbonY)
            .attr('width', self.dimRibbonWidth)
            .attr('height', self.dimRibbonHeight)
            .attr('fill', (d, i) => Data.subs[p][i] === '0' ? 'white': '#252525')
            // .attr('fill-opacity', (d, i) => Data.subs[p][i] === '0' ? 1: 0.4)
          d3.select(this)
            .append('rect')
            .attr('class', 'subSelected')
            .attr('x', self.highlightRibbonX)
            .attr('y', self.highlightRibbonY)
            .attr('width', self.highlightRibbonWidth)
            .attr('height', self.highlightRibbonHeight)
            .style('stroke-width', self.highlightRibbonStrokeWidth)
            .style('opacity', 0)
          d3.select(this)
            .on('mouseover', () => {
              if (!d3.select(this).classed('listItemHoverDisabled')) {
                d3.select(this).classed('listItemHovered', true)
                d3.select(this).select('.subSelected').style('opacity', 1)
                self.updateView('subSelect')
                self.updateUpdateMapBySub({
                  subIds: [p + ''],
                  type: 'hover'
                })
              }
            })
            .on('mouseout', () => {
              if (!d3.select(this).classed('listItemClicked')) {
                d3.select(this)
                  .classed('listItemHovered', false)
                  .classed('listItemHoverDisabled', false)
                d3.select(this).select('.subSelected').style('opacity', 0)
                self.updateView('subUnselect')
                self.updateUpdateMapBySub({
                  subIds: undefined,
                  type: 'hover'
                })
              }
            })
            .on('click', () => {
              if (d3.select(this).classed('listItemClicked')) {
                d3.select(this)
                  .classed('listItemClicked', false)
                  .classed('listItemHoverDisabled', true)
                d3.select(this).select('.subSelected').style('opacity', 0)
                self.updateView('subUnselect')
                self.updateUpdateMapBySub({
                  subIds: undefined,
                  type: 'click'
                })
              } else {
                // 把之前click的都取消掉
                self.listSvg.selectAll('.listItemG')
                  .classed('listItemClicked', false)
                  .classed('listItemHoverDisabled', false)
                self.listSvg.selectAll('.subSelected').style('opacity', 0)
                d3.select(this)
                  .classed('listItemHovered', false)
                  .classed('listItemClicked', true)
                  .classed('listItemHoverDisabled', true)
                d3.select(this).select('.subSelected').style('opacity', 1)
                self.updateView('subSelect')
                self.updateUpdateMapBySub({
                  subIds: [p + ''],
                  type: 'click'
                })
              }
            })
        })
      
      // this.listSvg.selectAll('.dimRibbon')
      //   .filter(function () {
      //     return d3.select(this).attr('fill') === 'white'
      //   })
      //   .remove()
      this.listSvg.selectAll('.dimRibbon')
        .attr('fill-opacity', 0.6)
    },
    targetedModification: function () {
      const file = Data.file

      let fontsize

      switch (file) {
        case 'Wine':
          fontsize = 0.9
          this.rotateDeg = 35
          this.histFilterDimNameY = this.histFilterDim1stR * 4.5
          break
        case 'Pendigits':
          fontsize = 0.7
          // this.rotateDeg = 30
          this.rotateDeg = 0
          this.histFilterDimNameX = this.histFilterItemWidth / 2
          this.histFilterDimNameY = this.histFilterDim1stR * 6
          this.histSvg.selectAll('.histFilterDimName')
            .attr('x', this.histFilterDimNameX)
            .style('text-anchor', 'middle')
          this.histSvg.selectAll('.histDimNum')
            .style('font-size', '0.7em')
          break
        default:
          fontsize = 0.95
          this.rotateDeg = 25
          this.histFilterDimNameY = this.histFilterDim1stR * 3
      }

      this.histSvg.selectAll('.histFilterDimName')
        .attr('y', this.histFilterDimNameY)
        .attr('transform', `rotate(${this.rotateDeg})`)
        .style('font-size', `${fontsize}em`)

      if (file === 'Pendigits') {
        this.histSvg.selectAll('.histFilterDimName')
          .each(function (d) {
            const num = Number(d3.select(this).text().replace('F', ' '))
            if (num > 9) {
              d3.select(this).style('font-size', '0.55em')
            }
          })
      }
    },
    getSubOrder: function () {
      const leafNodes = this.leafNodes
      let subOrder = []
      let clusterSubOrder = []
      const subtree = Data.subtree
      // for (let i = 0; i < subtree.data.dscTraversalOrder.length; i++) {
      //   if (subtree.data.dscTraversalOrder[i][1] == 0) {
      //     // this is a cluster
      //     clusterSubOrder.push(...subtree.children[subtree.data.dscTraversalOrder[i][0]].data.glbTraversalOrder)
      //   } else {
      //     // this is a leaf
      //     subOrder.push(subtree.data.dscTraversalOrder[i][0])
      //   }
      // }

      let sortedIndices = getIndicesBySortingSubIds(Data.nationalCaps)
      for (let i = 0; i < sortedIndices.length; i++) {
        clusterSubOrder.push(...subtree.children[sortedIndices[i]].data.glbTraversalOrder)
      }
      for (let i = 0; i < subtree.data.dscTraversalOrder.length; i++) {
        if (subtree.data.dscTraversalOrder[i][1] != 0) {
          subOrder.push(subtree.data.dscTraversalOrder[i][0])
        }
      }

      subOrder.unshift(...clusterSubOrder)
      return subOrder

      function getIndicesBySortingSubIds (subIds) {
        let yCoords = []
        for (let i = 0; i < subIds.length; i++) {
          let subId = subIds[i]
          let node = leafNodes.find(node => node.ID === subId)
          yCoords.push(node.center.coordinates.y)
        }
        return getSortedIndices(yCoords)
      }

      function getSortedIndices (arr) {
        return arr.map((val, ind) => { return { ind, val } })
          .sort((a, b) => { return a.val > b.val ? 1 : a.val == b.val ? 0 : -1 })
          .map(obj => obj.ind)
      }
    },
    updateView: function (type) {
      const self = this
      let remainingSubIds
      if (type === 'dimClick') {
        remainingSubIds = this.filterSubsByHistFilter(this.currSubs)
        this.updateHist(remainingSubIds)
        this.updateList(remainingSubIds)
      } else if (type === 'subSelect') {
        remainingSubIds = filterSubsByListItem()
        this.updateHist(remainingSubIds)
      } else if (type === 'subUnselect') {
        remainingSubIds = filterSubsByListItem()
        if (remainingSubIds.length === 0) {
          remainingSubIds = this.filterSubsByHistFilter(this.currSubs)
        }
        this.updateHist(remainingSubIds)
      }

      function filterSubsByListItem () {
        let res = []
        self.listSvg.selectAll('.listItemG').each(function (p, idx) {
          if (d3.select(this).classed('listItemHovered') || d3.select(this).classed('listItemClicked')) {
            res.push(p)
          }
        })
        return res
      }
    },
    filterSubsByHistFilter: function (subs) {
      const self = this
      let res = []
      for (let i = 0; i < subs.length; i++) {
        const isFilterByHide = isFilter(subs[i], 'hide')
        const isFilterByShow = isFilter(subs[i], 'show')
        if (!isFilterByHide && !isFilterByShow) {
          res.push(Data.subs.indexOf(subs[i]))
        }
      }
      return res

      function isFilter(sub, state) {
        let idx = 0
        if (state === 'hide') {
          while (idx < self.hideDims.length) {
            const dimIdx = self.hideDims[idx]
            if (sub[dimIdx] === '1') {
              return true
            }
            idx++
          }
        } else {
          while (idx < self.showDims.length) {
            const dimIdx = self.showDims[idx]
            if (sub[dimIdx] === '0') {
              return true
            }
            idx++
          }
        }
        return false
      }
    },
    updateHist: function (remainingSubIds) {
      let remainingDimCounts = new Array(Data.dims.length).fill(0)
      for (let i = 0; i < remainingSubIds.length; i++) {
        const subArr = Data.subs[remainingSubIds[i]].split('').map(Number)
        remainingDimCounts = remainingDimCounts.map((d, i) => d + subArr[i])
      }
      this.histBarY.domain([0, d3.max(remainingDimCounts)])
      this.histG
        .selectAll('.histBar')
        .data(remainingDimCounts)
        .transition()
        .duration(this.animationDuration)
        .attr('y', d => this.histBarY(d))
        .attr('height', d => this.histBarY(0) - this.histBarY(d))
      
      this.histG
        .selectAll('.histDimNum')
        .data(remainingDimCounts)
        .transition()
        .duration(this.animationDuration)
        .attr('y', d => this.histBarY(d) - this.histBarNumYSpacing)
        .text(d => d)
    },
    updateList: function (remainingSubIds) {
      const self = this
      let prevHiddenListItemIds = []
      const prevHiddenListItems = this.listSvg.selectAll('.listItemG')
        .filter(function () {
          if (d3.select(this).style('visibility') === 'hidden') {
            const thisId = parseInt(d3.select(this).attr('subId'))
            prevHiddenListItemIds.push(thisId)
            return true
          }
        })
      const hiddenListItems = this.listSvg.selectAll('.listItemG')
        .filter(function () {
          const thisId = parseInt(d3.select(this).attr('subId'))
          return remainingSubIds.indexOf(thisId) === -1
        })
      const shownListItems = this.listSvg.selectAll('.listItemG')
        .filter(function () {
          const thisId = parseInt(d3.select(this).attr('subId'))
          return remainingSubIds.indexOf(thisId) != -1
        })

      let HideListItemsDeferred = $.Deferred()
      let translateShownListItemsDeferred = $.Deferred()

      makeHiddenListItemsInvisible(HideListItemsDeferred)
      $.when(HideListItemsDeferred).done(() => translateShownListItems(translateShownListItemsDeferred))
      $.when(translateShownListItemsDeferred).done(makeShownListItemsVisible)

      function makeHiddenListItemsInvisible (deferred) {
        const neededHiddenListItems = hiddenListItems.filter(function () {
          const thisId = parseInt(d3.select(this).attr('subId'))
          return prevHiddenListItemIds.indexOf(thisId) === -1      
        })
        if (neededHiddenListItems._groups[0].length === 0) {
          deferred.resolve()
          return
        }
        neededHiddenListItems
          .transition()
          .duration(500)
          .style('opacity', 0)
          .on('end', function (d, i) {
            d3.select(this).style('visibility', 'hidden')
            if (i === neededHiddenListItems._groups[0].length - 1) {
              deferred.resolve()
            }
          })
      }

      function translateShownListItems (deferred) {
        let currHeight = self.listItemHeight * remainingSubIds.length
        if (currHeight > self.listHeight) {
          self.listHeight = currHeight
          d3.select(self.$el).select('#list').select('svg')
            .attr('height', self.listHeight)
        }
        shownListItems
          .transition()
          .duration(700)
          .attr('transform', (d, i) => `translate(0, ${self.listItemHeight * i})`)
          .on('end', (d, i) => {
            if (i === shownListItems._groups[0].length - 1) {
              deferred.resolve()
            }
          })
      }

      function makeShownListItemsVisible () {
        self.listHeight = self.listItemHeight * remainingSubIds.length
        d3.select(self.$el).select('#list').select('svg')
          .attr('height', self.listHeight)
        shownListItems
          .style('visibility', 'visible')
          .transition()
          .duration(500)
          .style('opacity', 1)
      }
      
      // if (prevHiddenListItems._groups[0].length > hiddenListItems._groups[0].length) {
      //   translateShownListItems()
      // } else {
      //   makeHiddenListItemsInvisible()
      // }

      // function makeHiddenListItemsInvisible () {
      //   let deferArr = new Array(hiddenListItems._groups[0].length).fill($.Deferred())
      //   hiddenListItems
      //     .transition()
      //     .duration(500)
      //     .style('opacity', 0)
      //     .on('end', function (d, i) {
      //       d3.select(this).style('visibility', 'hidden')
      //       deferArr[i].resolve()
      //     })
      //   $.when.apply(null, deferArr).done(translateShownListItems)
      // }

      // function translateShownListItems () {
      //   let currHeight = self.listItemHeight * remainingSubIds.length
      //   if (currHeight > self.listHeight) {
      //     self.listHeight = currHeight
      //     d3.select(self.$el).select('#list').select('svg')
      //       .attr('height', self.listHeight)
      //   }
      //   let deferArr = new Array(shownListItems._groups[0].length).fill($.Deferred())
      //   shownListItems
      //     .transition()
      //     .duration(700)
      //     .attr('transform', (d, i) => `translate(0, ${self.listItemHeight * i})`)
      //     .on('end', (d, i) => {
      //       deferArr[i].resolve()
      //     })
      //   $.when.apply(null, deferArr).done(makeShownListItemsVisible)
      // }

      // function makeShownListItemsVisible () {
      //   self.listHeight = self.listItemHeight * remainingSubIds.length
      //   d3.select(self.$el).select('#list').select('svg')
      //     .attr('height', self.listHeight)
      //   shownListItems
      //     .style('visibility', 'visible')
      //     .transition()
      //     .duration(500)
      //     .style('opacity', 1)
      // }
    },
    getSubsByPath: function (path2This) {
      let thisDict = Data.subtree.findByIndex(path2This).dict
      let subIds = []
      for (let i = 0; i < thisDict.length; i++) {
        subIds.push(thisDict[i][0])
      }
      let subs = []
      for (let i = 0; i < subIds.length; i++) {
        subs.push(Data.subs[subIds[i]])
      }
      subIds = this.filterSubsByHistFilter(subs)
      return subIds
    },
    updateMapByDim: function () {
      let dimStates = new Array(Data.dims.length).fill(-1)
      dimStates.needed = false
      for (let i = 0; i < this.showDims.length; i++) {
        dimStates[this.showDims[i]] = 1
      }
      for (let i = 0; i < this.hideDims.length; i++) {
        dimStates[this.hideDims[i]] = 0
      }
      if (this.showDims.length !== 0 || this.hideDims.length !== 0) {
        dimStates.needed = true
      }
      this.updateUpdateMapByDim({
        dimStates: dimStates
      })
    },
    histFilterDimNameFontSizeAdjustment: function () {
      const line = d3.line()
        .x(d => d.x)
        .y(d => d.y)

      let fontsize
      let intersect = true
      while (intersect) {
        fontsize = parseFloat(this.histSvg.select('.histFilterDimName').style('font-size'))
        intersect = false
        let rectCoords = []
        for (const node of this.histSvg.selectAll('.histFilterDimName')._groups[0]) {
          const domRect = node.getBoundingClientRect()
          rectCoords.push([
            { x: domRect.x, y: domRect.y },
            { x: domRect.x + domRect.width, y: domRect.y},
            { x: domRect.x + domRect.width, y: domRect.y + domRect.height },
            { x: domRect.x, y: domRect.y + domRect.height }
          ])
        }
        const rectRotatedCoords = this._rectRotatedCoords(rectCoords, this.rotateDeg)
        for (let i = 0; i < rectRotatedCoords.length - 1; i++) {
          if (this._polygonsIntersect(rectRotatedCoords[i], rectRotatedCoords[i + 1])) {
            fontsize -= 0.2
            this.histSvg.selectAll('.histFilterDimName').style('font-size', `${fontsize}px`)
            intersect = true
            break
          }
        }
        // if (intersect === false) {
        //   this.listSvg.selectAll('.boundingBox')
        //     .data(rectRotatedCoords)
        //     .enter()
        //     .append('path')
        //     .attr('class', 'boundingBox')
        //     .attr('d', d => line(d))
        //     .attr('stroke-width', '1px')
        //     .attr('stroke', 'black')
        //   break
        // }
      }
    },
    _deg2rad: function (deg) {
      return deg * Math.PI / 180
    },
    _rectRotatedCoords: function (coords, deg) {
      let rotatedCoords = []
      const rad = this._deg2rad(deg)

      for (const rectCoords of coords) {
        const cx = (rectCoords[0].x + rectCoords[1].x) / 2
        const cy = (rectCoords[0].y + rectCoords[2].y) / 2
        let thisRectRotatedCoords = []
        for (const coord of rectCoords) {
          const originX = coord.x - cx
          const originY = coord.y - cy
          const rotatedX = originX * Math.cos(rad) - originY * Math.sin(rad)
          const rotatedY = originX * Math.sin(rad) + originY * Math.cos(rad)
          const x = rotatedX + cx
          const y = rotatedY + cy
          thisRectRotatedCoords.push({ x: x, y: y })
        }
        rotatedCoords.push(thisRectRotatedCoords)
      }

      return rotatedCoords
    },
    _polygonsIntersect: function (a, b) {
      var polygons = [a, b];
      var minA, maxA, projected, i, i1, j, minB, maxB;

      for (i = 0; i < polygons.length; i++) {

        // for each polygon, look at each edge of the polygon, and determine if it separates
        // the two shapes
        var polygon = polygons[i];
        for (i1 = 0; i1 < polygon.length; i1++) {

          // grab 2 vertices to create an edge
          var i2 = (i1 + 1) % polygon.length;
          var p1 = polygon[i1];
          var p2 = polygon[i2];

          // find the line perpendicular to this edge
          var normal = { x: p2.y - p1.y, y: p1.x - p2.x };

          minA = maxA = undefined;
          // for each vertex in the first shape, project it onto the line perpendicular to the edge
          // and keep track of the min and max of these values
          for (j = 0; j < a.length; j++) {
              projected = normal.x * a[j].x + normal.y * a[j].y;
              if (minA === undefined || projected < minA) {
                  minA = projected;
              }
              if (maxA === undefined || projected > maxA) {
                  maxA = projected;
              }
          }

          // for each vertex in the second shape, project it onto the line perpendicular to the edge
          // and keep track of the min and max of these values
          minB = maxB = undefined;
          for (j = 0; j < b.length; j++) {
              projected = normal.x * b[j].x + normal.y * b[j].y;
              if (minB === undefined || projected < minB) {
                  minB = projected;
              }
              if (maxB === undefined || projected > maxB) {
                  maxB = projected;
              }
          }

          // if there is no overlap between the projects, the edge we are looking at separates the two
          // polygons, and we know there is no overlap
          if (maxA < minB || maxB < minA) {
              return false;
          }
        }
      }
      return true;
    }
  }
};
</script>

<style lang="less">
@y-margin: 2%;
@x-margin: 3%;
@height: 100%;
@width: 100%;
@hist-top-margin: 2%;
// @hist-x-margin: 3%;
@hist-x-margin: 0%;
@hist-height: 24%;
@hist-width: @width - 2 * @hist-x-margin;
@list-top-margin: 2%;
// @list-top: @hist-top-margin + @hist-height;
// @list-top: @hist-height;
@list-top: 20%;
@list-height: @height - @list-top - @hist-top-margin;
@list-width: @width;

#subList {
  height: @height;
  width: @width;
}

#hist {
  margin-top: @hist-top-margin;
  // margin: @hist-top-margin @hist-x-margin 0px;
  height: @hist-height;
  width: @hist-width;
}

#list {
  position: absolute;
  top: @list-top;
  left: 0px;
  margin-top: @list-top-margin;
  width: @list-width;
  height: @list-height;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Hide scrollbar for all elements */
#list::-webkit-scrollbar {
  width: 0px;  /* Remove scrollbar space */
  background: transparent;  /* Optional: make scrollbar invisible */
}

/* Display scrollbar while scrolling */
#list:hover::-webkit-scrollbar, 
#list:active::-webkit-scrollbar {
  width: 5px;
}

#list:hover::-webkit-scrollbar-thumb, 
#list:active::-webkit-scrollbar-thumb {
  background-color: #888;  /* Color of the scroll thumb */
}

#list:hover::-webkit-scrollbar-thumb:hover, 
#list:active::-webkit-scrollbar-thumb:hover {
  background-color: #888;  /* Color of the scroll thumb on hover */
}

.histBar {
  fill: #252525;
}

.histDimNum {
  text-anchor: middle;
  dominant-baseline: central;
  font-size: 0.8em;
  cursor: default;
}

.histFilterDimShow {
  fill: #252525;
  cursor: pointer;
}

.histFilterDimHide {
  fill: white;
  cursor: pointer;
}

.histFilterDimName {
  text-anchor: start;
  dominant-baseline: middle;
  font-size: 0.95em;
  cursor: default;
}

.subRibbon {
  cursor: pointer;
  fill-opacity: 0.4;
}

.subSelected {
  stroke: #252525;
  fill: none;
}
</style>