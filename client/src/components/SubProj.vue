<template>
  <div id="subProj">
    <div id="subProjSvgContainer"></div>
    <div id="switchBtn">
      <!-- <el-button size="mini" @click="changeShowType">Projection</el-button> -->
      <el-switch v-model="switchVal" active-color="#ddd" inactive-color="#ddd" active-text="Stability" inactive-text="Projection" @change="changeShowType"></el-switch>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
const numeric = require('numeric')
export default {
  name: 'SubProj',
  data() {
    return {
      dimDominatingThreshold: {
        browse: {
          low: 0.1,
          high: 0.9
        },
        airTravel: {
          low: 0.2,
          high: 0.8
        },
        groundTravel: {
          low: 0.2,
          high: 0.8
        }
      },
      showType: 'respective',
      switchVal: false,
      mode: 'browse',
      groundTravelLegends: ['Origin', 'Current position', 'Destination'],
      airTravelProjParam: 2,
      btmLevelClsParam: 2,
      maxProjNumOnScreen: 4,
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.setLayout()
    })
  },
  computed: {
    ...mapGetters([
      // 'loadedData',
      'updateMap',
      'changeMode',
      'drawProjection',
      'changeProjInBrowseMode',
      'changeSubProjOpacity'
    ])
  },
  watch: {
    // loadedData: function (val, oldVal) {
    //   this.updateParams()
    //   if (oldVal != null) {
    //     this.redraw()
    //   } else {
    //     this.init()
    //     this.drawCapsProj(this.svg.select('#capsProjG'), null, 'unified')
    //     // this.drawCapsProj(this.svg.select('#nationalCapsRespectiveProjG'), 'respective')
    //   }
    // },
    updateMap: function (val, oldVal) {
      d3.select(this.$el).select('#switchBtn').style('visibility', 'visible')
      this.updateParams()
      this.map = val.map
      this.leafNodes = Array.from(this.map.allLeaves.values())
      if (val.resize) {
        this.setLayout()
      }
      if (oldVal.map != null) {
        // this.redraw()
        this.clear()
      }
      this.init()
      this.drawCapsProj(this.svg.select('#capsProjG'), null, 'respective')
      // this.drawCapsProj(this.svg.select('#nationalCapsRespectiveProjG'), 'respective')
    },
    changeMode: function (val) {
      this.mode = val.mode
      d3.selectAll(this.d3el.select('#projSvg').node().children)
        .style('visibility', 'hidden')
      switch (val.mode) {
        case 'browse':
          let g = this.d3el.select('#projSvg').select('#capsProjG')
          g.selectAll('*').remove()
          this.drawCapsProj(g, null, this.showType)
          g.style('visibility', 'visible')
          break
        case 'airTravel':
          g = this.svg.select('#airTravelProjG')
          g.select('#transitionProj').selectAll('*').remove()
          g.style('visibility', 'visible')
          break
        case 'groundTravel':
          g = this.svg.select('#groundTravelProjG')
          g.select('#originProj').selectAll('*').remove()
          g.select('#transitionProj').selectAll('*').remove()
          g.select('#destinationProj').selectAll('*').remove()
          this.updateProjParams(3)
          g.style('visibility', 'visible')
          break
      }
    },
    drawProjection: function (val) {
      if (this.mode === 'groundTravel') {
        if (val.type === 'origin') {
          // this.updateProjParams(3)
          let g = this.svg.select('#groundTravelProjG')
          g.select('#originProj').selectAll('*').remove()
          g.select('#transitionProj').selectAll('*').remove()
          g.select('#destinationProj').selectAll('*').remove()
          this.drawProj(g.select('#originProj'), this.showType, val.subId, 'city', null)
          this.originSubId = val.subId
        } else if (val.type === 'destination') {
          let g = this.svg.select('#groundTravelProjG')
          this.drawProj(g.select('#transitionProj'), this.showType, this.originSubId, 'city', null)
          this.drawProj(g.select('#destinationProj'), this.showType, val.subId, 'city', null)
        } else if (val.type === 'transition') {
          let g = this.svg.select('#groundTravelProjG').select('#transitionProj')
          this.switchCityProj(g, this.showType, val.subId)
        }
      } else if (this.mode === 'airTravel') {
        let g = this.svg.select('#airTravelProjG').select('#transitionProj')
        if (val.type === 'origin') {
          // this.updateProjParams(3)
          this.updateProjParams(this.airTravelProjParam)
          g.selectAll('*').remove()
          this.drawProj(g, this.showType, val.subId, 'city', null)
        } else if (val.type === 'transition') {
          this.switchCityProj(g, this.showType, val.subId)
        } else if (val.type === 'clear') {
          g.selectAll('*').remove()
        }
      }
    },
    changeProjInBrowseMode: function (val) {
      this.svg.select('#capsProjG').selectAll('*').remove()
      this.drawCapsProj(this.svg.select('#capsProjG'), val.parentClsID, this.showType)
    },
    changeSubProjOpacity: function (val) {
      if (val.action === 'mouseover') {
        let clsID = val.clsID
        if (clsID.includes('_')) {
          clsID = clsID.replace('_', ',')
        }
        // this.svg.select('#capsProjG').selectAll('.capProj')
        //   .filter(function () {
        //     return d3.select(this).attr('clsID') !== String(clsID)
        //   })
        //   .style('opacity', 0.2)
        
        const projOrder = Array.from(this.svg.select('#capsProjG').node().children).findIndex(child => child.attributes.clsID.nodeValue === clsID)
        if (projOrder + 1 > this.maxProjNumOnScreen) {
          const existingProjNum = this.svg.select('#capsProjG').selectAll('.capProj')._groups[0].length
          const maxScrollNum = existingProjNum - this.maxProjNumOnScreen
          const scrollNum = projOrder - maxScrollNum > 0 ? maxScrollNum : projOrder
          const scrollHeight = scrollNum * (this.projHeight + this.projYPadding)
          d3.select('#subProjSvgContainer')
            .transition()
            .duration(1500)
            .tween('uniquetweenname', scrollTopTween(scrollHeight))
            .on('end', () => {
              this.svg.select('#capsProjG').selectAll('.capProj')
                .filter(function () {
                  return d3.select(this).attr('clsID') !== String(clsID)
                })
                .style('opacity', 0.2)
            })
        } else {
          this.svg.select('#capsProjG').selectAll('.capProj')
            .filter(function () {
              return d3.select(this).attr('clsID') !== String(clsID)
            })
            .style('opacity', 0.2)
        }
      } else {
        this.svg.select('#capsProjG').selectAll('.capProj').style('opacity', 1)
        d3.select('#subProjSvgContainer')
            .transition()
            .duration(1500)
            .tween('uniquetweenname', scrollTopTween(0))
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
      'updateUpdateSubList'
    ]),
    setLayout: function () {
      let btnDiv = d3.select(this.$el).select('#switchBtn')
      let btnSize = btnDiv.node().getBoundingClientRect()
      let btnWidth = btnSize.width
      // let btnHeight = btnSize.height
      let btnHeight = parseFloat(d3.select(this.$el).select('#switchBtn').select('.el-switch').style('height'))
      btnDiv
        .style('width', btnWidth + 'px')
        // .style('top', btnHeight / 3 + 'px')
        .style('top', 0 + 'px')
        .style('height', btnHeight + 'px')
      // btnDiv.select('button')
      //   .style('width', btnWidth + 'px')
      //   .on('mouseover', function () {
      //     d3.select(this)
      //       .classed('btnHovered', true)
      //       .classed('btnUnhovered', false)
      //   })
      //   .on('mouseout', function () {
      //     d3.select(this)
      //       .classed('btnHovered', false)
      //       .classed('btnUnhovered', true)
      //   })
      // btnDiv.select('button').select('span')
      //     .node().innerHTML = 'Stability'
      // // btnDiv.style('visibility', 'visible')
      
      let height = this.$el.offsetHeight - btnHeight
      d3.select(this.$el).select('#subProjSvgContainer')
        .style('position', 'absolute')
        .style('top', `${btnHeight}px`)
        .style('left', '0px')
        .style('height', `${height}px`)
        .style('width', `${this.$el.offsetWidth}px`)
    },
    updateParams: function () {
      this.switchBtnHeight = d3.select(this.$el).select('#switchBtn').node().getBoundingClientRect().height
      this.width = this.$el.offsetWidth
      // this.width = this.$el.offsetWidth - this.switchBtnHeight
      this.height = this.$el.offsetHeight - this.switchBtnHeight

      this.projYPadding = 2 * parseFloat(toPX('1rem'))

      this.d3el = d3.select(this.$el).select('#subProjSvgContainer')
      this.boundaryCircleStrokeWidth = this.width * 0.00675
      this.circleR = this.width * 0.0075
      if (Data.file === 'Pendigits') {
        this.circleR = this.width * 0.003
      }
      if (Data.file === 'Pendigits') {
        this.dimDominatingThreshold.browse.low = 1 / 6
        this.dimDominatingThreshold.browse.high = 5 / 6
      }
      this.dimCircleR = this.width * 0.03
      this.dimPointR = {
        backgroundDimPoint: {
          '-1': this.dimCircleR * 0.55,
          '0': this.dimCircleR * 0.45,
          '1': this.dimCircleR * 0.7
        },
        midgroundDimPoint: {
          '-1': this.dimCircleR * 0.55,
          '0': this.dimCircleR * 0.45,
          '1': this.dimCircleR * 0.7
        },
        foregroundDimPoint: {
          '-1': this.dimCircleR * 0.55,
          '0': this.dimCircleR * 0.45,
          '1': this.dimCircleR * 0.325
        },
      }
      this.dimPointStrokeWidth = {
        backgroundDimPoint: {
          '-1': this.dimCircleR * 0.2,
          '0': 0,
          '1': this.dimCircleR * 0.2
        },
        midgroundDimPoint: {
          '-1': this.dimCircleR * 0.2,
          '0': 0,
          '1': this.dimCircleR * 0.2
        },
        foregroundDimPoint: {
          '-1': this.dimCircleR * 0.2,
          '0': 0,
          '1': 0
        }
      }

      this.opcScale = {
        'browse': d3.scaleLinear().range([0.1, 1]),
        'airTravel': d3.scaleLinear()
          .domain(d3.extent(Data.dataWeights.flat()))
          .range([0.1, 1]),
        'groundTravel': d3.scaleLinear().range([0.1, 1]).clamp(true)
      }
      let caps = Array.from(new Set(Data.nationalCaps.concat(Data.provincialCaps)))
      this.opcScale['groundTravel'].domain(d3.extent(Data.dataWeights.filter((d, i) => caps.indexOf(i) !== -1).flat()))

      this.opcScaleNew = d => {
        let t = d * 20 - 10
        return 1 / (Math.exp(-t) + 1)
      }

      // this.unifiedProj = Data.dataProjs[Data.subs.indexOf(new Array(Data.dims.length).fill(1).join(''))]
      
      this.unifiedProj = []
      let dataNum = Data.dataProjs[0].length
      let cellNum = Math.ceil(Math.sqrt(dataNum))
      for (let i = 0; i < cellNum; i++) {
        for (let j = 0; j < cellNum; j++) {
          this.unifiedProj.push([
            j * 1 / cellNum,
            (cellNum - i - 1) * 1 / cellNum
          ])
        }
      }
      this.unifiedProj.splice(dataNum)

      // let evenlyDistributedCircle = sunflower(Data.dataProjs[0].length, 2)
      // let circleXscale = d3.scaleLinear()
      //   .domain(d3.extent(evenlyDistributedCircle, d => d[0]))
      //   .range([-Math.sqrt(2) * 0.125, 1 + Math.sqrt(2) * 0.125])
      // let circleYscale = d3.scaleLinear()
      //   .domain(d3.extent(evenlyDistributedCircle, d => d[1]))
      //   .range([-Math.sqrt(2) * 0.125, 1 + Math.sqrt(2) * 0.125])
      // this.unifiedProj = evenlyDistributedCircle.map(d => {
      //   return [circleXscale(d[0]), circleYscale(d[1])]
      // })

      function sunflower (n, alpha) {
        let coords = []
        let b = Math.round(alpha * Math.sqrt(n)) // number of boundary points
        let phi = (Math.sqrt(5) + 1) / 2 // golden ratio
        for (let k = 1; k < n + 1; k++) {
          let r = radius(k, n, b)
          let theta = 2 * Math.PI * k / Math.pow(phi, 2)
          coords.push([
            r * Math.cos(theta),
            r * Math.sin(theta)
          ])
        }
        return coords
      }

      function radius (k, n, b) {
        let r
        if (k > n - b) {
          r = 1 // put on the boundary
        } else {
          r = Math.sqrt(k - 1 / 2) / Math.sqrt(n - (b + 1) / 2) // apply square root
        }
        return r
      }
    },
    init: function () {
      this.svgProjWidthDiff = this.switchBtnHeight * 2
      if (Data.file === 'Forestfires') {
        this.svgProjWidthDiff = this.switchBtnHeight * 3.5
      }
      this.svg = this.d3el
        .append('svg')
        .attr('width', this.width)
        .attr('height', this.height)
        .append('g')
        .attr('id', 'projSvg')
      this.svg
        .append('g')
        .attr('id', 'capsProjG')
      // this.svg
      //   .append('g')
      //   .attr('id', 'nationalCapsRespectiveProjG')
      //   .style('visibility', 'hidden')
      let groundTravelProjG = this.svg
        .append('g')
        .attr('id', 'groundTravelProjG')
        .style('visibility', 'hidden')
      let airTravelProjG = this.svg
        .append('g')
        .attr('id', 'airTravelProjG')
        .style('visibility', 'hidden')
      this.updateProjParams(3)
      this.drawGroundTravelLegend(groundTravelProjG)
      groundTravelProjG
        .selectAll('.groundTravelProj')
        .data([0, 1, 2])
        .enter()
        .append('g')
        .attr('id', (d, i) => {
          if (i === 0) {
            return 'originProj'
          } else if (i === 1) {
            return 'transitionProj'
          } else if (i === 2) {
            return 'destinationProj'
          }
        })
        .attr('transform', (d, i) => `translate(${this.svgProjWidthDiff / 2}, ${this.projHeight * i + this.projYPadding * (i + 1 / 2)})`)
      airTravelProjG
        .append('g')
        .attr('id', 'transitionProj')
        .attr('transform', `translate(${this.svgProjWidthDiff / 2}, ${this.projYPadding / 2})`)
    },
    changeShowType: function () {
      const self = this
      // d3.select(this.$el).select('#switchBtn').select('button').select('span')
      //     .node().innerHTML = `${this.showType.charAt(0).toUpperCase() + this.showType.slice(1)}`
      if (this.showType === 'unified') {
        this.showType = 'respective'
        // d3.select(this.$el).select('#switchBtn').select('button').select('span')
        //   .node().innerHTML = 'Stability'
        this.switchVal = false
      } else if (this.showType === 'respective') {
        this.showType = 'unified'
        // d3.select(this.$el).select('#switchBtn').select('button').select('span')
        //   .node().innerHTML = 'Projection'
        this.switchVal = true
      }
      if (this.mode === 'browse') {
        this.svg.select(`#capsProjG`).selectAll('.capProj')
          .each(function (p, idx) {
            let subId = Number(d3.select(this).attr('subId'))
            let proj
            if (self.showType === 'unified') {
              proj = self.unifiedProj
            } else if (self.showType === 'respective') {
              proj = Data.dataProjs[subId]
            }
            d3.select(this).selectAll('.projPoints')
              .data(proj)
              .join('circle')
              .transition()
              .duration(600)
              .attr('cx', d => self.projPointScale.x(d[0]))
              .attr('cy', d => self.projPointScale.y(d[1]))
          })
      } else if (this.mode === 'groundTravel') {
        let subMapTiling = d3.select('#subMap').select('.SubMapTiling')
        subMapTiling.selectAll('.landRoute').classed('routeUnselected', false)
        SubMapTiling.selectAll('.seaRoute').classed('routeUnselected', false)
        subMapTiling.selectAll('.travelIcon').remove()
        let grids = subMapTiling.selectAll('.SubMapGrids')
        grids.classed('travelUnselected', false)
          .classed('gridClicked', false)
          .attr('cursor', 'pointer')
          .attr('opacity', 1)
          .on('mouseover', null)
          .on('mouseout', null)
          .on('click', null)
        this.resetSubList()
        this.resetCapsOpacity()
        let caps = Data.nationalCaps.concat(Data.provincialCaps)
        let capGrids = grids.filter(function () {
          return caps.indexOf(Number(d3.select(this).attr('index'))) !== -1
        })
        let nonCapGrids = grids.filter(function () {
          return caps.indexOf(Number(d3.select(this).attr('index'))) === -1
        })
        capGrids.classed('travelUnselected', false)
        capGrids.classed('gridClicked', false)
        nonCapGrids.attr('opacity', 0.2)
        let g = this.svg.select('#groundTravelProjG')
        g.select('#originProj').selectAll('*').remove()
        g.select('#transitionProj').selectAll('*').remove()
        g.select('#destinationProj').selectAll('*').remove()
        this.updateUpdateSubList({
          path2This: undefined,
          subIds: caps,
          type: 'changeShownItems'
        })
      } else if (this.mode === 'airTravel') {
        let subMapTiling = d3.select('#subMap').select('.SubMapTiling')
        subMapTiling.selectAll('.landRoute').classed('routeUnselected', false)
        SubMapTiling.selectAll('.seaRoute').classed('routeUnselected', false)
        subMapTiling.selectAll('.travelIcon').remove()
        let grids = subMapTiling.selectAll('.SubMapGrids')
        grids.classed('travelUnselected', false)
          .classed('gridUnhovered', false)
          .classed('gridClicked', false)
          .attr('opacity', 1)
        this.resetSubList()
        this.svg.select('#airTravelProjG').select('#transitionProj').selectAll('*').remove()
      }
    },
    redraw: function () {
      this.clear()
      this.drawCapsProj(this.svg.select('#capsProjG'), null, 'respective')
      // this.drawCapsProj(this.svg.select('#nationalCapsRespectiveProjG'), 'respective')
    },
    clear: function () {
      this.showType = 'respective'
      this.mode = 'browse'
      // d3.select(this.$el).select('#switchBtn').select('button').select('span')
      //     .node().innerHTML = `Stability`
      this.switchVal = false
      d3.select(this.$el).select('#subProjSvgContainer').selectAll('*').remove()
    },
    drawCapsProj: function (g, parentClsID, showType) {
      const self = this
      const leafNodes = this.leafNodes
      let capNum
      let sortedIndices = []
      let clsIDs = []
      let unsortedSubIds = []
      let sortedSubIds = []
      if (parentClsID === null) { // national cap proj
        capNum = Data.nationalCaps.length
        unsortedSubIds = Data.nationalCaps
        sortedIndices = getIndicesBySortingSubIds(unsortedSubIds)
        for (let i = 0; i < sortedIndices.length; i++) {
          clsIDs.push([sortedIndices[i]])
          sortedSubIds.push(unsortedSubIds[sortedIndices[i]])
        }
        this.updateProjParams(capNum)
      } else {
        const parentSubtree = Data.subtree.findByIndex(parentClsID)
        capNum = parentSubtree.children.length
        if (capNum === 0) { // the bottom level cluster
          capNum = 1
          clsIDs.push(parentClsID)
          sortedSubIds.push(parentSubtree.data.centerLeafName[0])
          // this.updateProjParams(3)
          this.updateProjParams(this.btmLevelClsParam)
        } else {
          // for (let i = 0; i < capNum; i++) {
          //   let subId = parentSubtree.children[i].data.centerLeafName[0]
          //   if (Data.nationalCaps.indexOf(subId) > -1) {
          //     clsIDs.push(parentClsID.concat(i))
          //     sortedSubIds.push(subId)
          //   } else {
          //     unsortedSubIds.push(subId)
          //   }
          // }
          for (let i = 0; i < capNum; i++) {
            let subId = parentSubtree.children[i].data.centerLeafName[0]
            unsortedSubIds.push(subId)
          }
          sortedIndices = getIndicesBySortingSubIds(unsortedSubIds)
          for (let i = 0; i < sortedIndices.length; i++) {
            clsIDs.push(parentClsID.concat(sortedIndices[i]))
            sortedSubIds.push(unsortedSubIds[sortedIndices[i]])
          }
          this.updateProjParams(capNum)
        }
      }

      let allDataWeights = []
      for (let i = 0; i < clsIDs.length; i++) {
        let clsID = clsIDs[i]
        const thisDataWeights = Data.subtree.findByIndex(clsID).data.dataWeights
        allDataWeights.push(...thisDataWeights)
      }
      let allDataSimilarities = numeric.sub(1, allDataWeights)
      this.opcScale[this.mode].domain(d3.extent(allDataSimilarities))
      
      // // for forestfires data, groundTravel mode
      // this.opcScale[this.mode].domain([0, 0.8371428571428572])

      // // for glass data, airTravel mode
      // this.opcScale[this.mode].domain([0, 1])

      g.selectAll(`.capProj`)
        .data(sortedSubIds)
        .enter()
        .append('g')
        .attr('class', `capProj`)
        .attr('subId', d => d)
        .attr('clsID', (d, i) => clsIDs[i])
        .attr('transform', (d, i) => `translate(${this.svgProjWidthDiff / 2}, ${this.projHeight * i + this.projYPadding * (i + 1 / 2)})`)
        .each(function (d, i) {
          self.drawProj(d3.select(this), showType, d, 'cap', clsIDs[i])
          // self.drawProj(d3.select(this), d, 'city', i)
        })
      
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
    updateProjParams: function (num) {
      let projNum = num > this.maxProjNumOnScreen ? this.maxProjNumOnScreen : num
      // this.svgProjWidthDiff = this.switchBtnHeight * 1.3
      this.projWidth = this.width - this.svgProjWidthDiff
      this.projHeight = this.height / projNum - this.projYPadding

      this.updateSvgHeight(num)

      this.projSize = Math.min(this.projHeight, this.projWidth)
      this.boundaryCircle = {
        r: this.projSize * 0.95 / 2,
        cx: this.projWidth / 2,
        cy: this.projHeight / 2
      }
      this.boundaryCircleOffset = {
        x: this.projWidth / 2 - this.boundaryCircle.r,
        y: this.projHeight / 2 - this.boundaryCircle.r
      }
      // this.projOffset = Math.min(this.boundaryCircleOffset.x, this.boundaryCircleOffset.y) * 0.5
      // this.projOffset = 0
      this.projOffset = this.dimCircleR * 0.45
      this.projPointScale = {
        x: d3.scaleLinear()
          .domain([0, 1])
          .range([
            this.boundaryCircleOffset.x + this.projOffset + (1 - Math.sqrt(2) / 2) * this.boundaryCircle.r,
            this.boundaryCircleOffset.x + this.boundaryCircle.r * 2 - this.projOffset - (1 - Math.sqrt(2) / 2) * this.boundaryCircle.r
          ]),
        y: d3.scaleLinear()
          .domain([1, 0])
          .range([
            this.boundaryCircleOffset.y + this.projOffset + (1 - Math.sqrt(2) / 2) * this.boundaryCircle.r,
            this.boundaryCircleOffset.y + this.boundaryCircle.r * 2 - this.projOffset - this.projOffset - (1 - Math.sqrt(2) / 2) * this.boundaryCircle.r
          ])
      }
      
      // this.projPointOpacityScale = d3.scaleLinear()
      //   .domain([0.9, 0.1])
      //   .range([0.1, 0.9])
      //   .clamp(true)

      // let opacityScale = {
      //   low: d3.scaleLinear()
      //     .domain([0, 0.3])
      //     .range([0, 0.15]),
      //   middle: d3.scaleLinear()
      //     .domain([0.3, 0.7])
      //     .range([0.4, 0.6]),
      //   high: d3.scaleLinear()
      //     .domain([0.7, 1])
      //     .range([0.85, 1]),
      // }
      // this.projPointOpacityScale = similarity => {
      //   if (similarity < 0.3) {
      //     return opacityScale.low(similarity)
      //   } else if (similarity < 0.7) {
      //     return opacityScale.middle(similarity)
      //   } else {
      //     return opacityScale.high(similarity)
      //   }
      // }
      
      this.dimCircleCoords = []
      for (let i = 0; i < Data.dims.length; i++) {
        this.dimCircleCoords.push([
          this.projWidth / 2 + this.boundaryCircle.r * Math.sin(Math.PI * 2 / Data.dims.length * i),
          this.projHeight / 2 - this.boundaryCircle.r * Math.cos(Math.PI * 2 / Data.dims.length * i)
        ])
      }
    },
    updateSvgHeight: function (num) {
      let height = num > this.maxProjNumOnScreen ? (this.projHeight + this.projYPadding) * num : this.height
      this.d3el.select('svg')
        .attr('height', height)
    },
    drawProj: function (g, showType, subId, type, clsID) {
      const self = this
      let proj
      if (showType === 'unified') {
        proj = this.unifiedProj
      } else if (showType === 'respective') {
        proj = Data.dataProjs[subId]
      }
      // let proj = Data.dataProjs[subId]
      let color = `rgb(${[
        ~~(255 * Data.colors[subId][0]),
        ~~(255 * Data.colors[subId][1]),
        ~~(255 * Data.colors[subId][2])
      ]})`
      let dataWeights
      let dimWeights
      let dimDominatingFlag
      if (type === 'cap') {
        const thisSubtreeData = Data.subtree.findByIndex(clsID).data
        dataWeights = thisSubtreeData.dataWeights
        dimWeights = thisSubtreeData.dimCounts
        dimDominatingFlag = this.checkDimDominating(dimWeights, thisSubtreeData.aggrNum)
      } else if (type === 'city') {
        dataWeights = Data.dataWeights[subId]
        // dimWeights = Data.dimWeights[subId]
        // dimDominatingFlag = this.checkDimDominating(dimWeights, Data.subKNN[0].length)
        dimDominatingFlag = []
        for (let i = 0; i < Data.subs[subId].length; i++) {
          if (Data.subs[subId][i] === '0') {
            dimDominatingFlag.push(-1)
          } else {
            dimDominatingFlag.push(1)
          }
        }
      }
      let dataSimilarities = numeric.sub(1, dataWeights)
      // this.opcScale.domain(d3.extent(dataSimilarities))

      g.append('circle')
        .attr('class', 'boundaryCircle')
        .attr('cx', this.boundaryCircle.cx)
        .attr('cy', this.boundaryCircle.cy)
        .attr('r', this.boundaryCircle.r)
        .style('stroke-width', this.boundaryCircleStrokeWidth)
        .style('stroke', color)
        .style('fill', 'white')
      g.selectAll('.dimPointsG')
        .data(this.dimCircleCoords)
        .enter()
        .append('g')
        .attr('class', 'dimPointsG')
        .attr('transform', d => `translate(${d})`)
        .each(drawDimPoint)
      g.append('g')
        .attr('class', 'projPointsG')
        .selectAll('.projPoints')
        .data(proj)
        .enter()
        .append('circle')
        .attr('class', 'projPoints')
        .attr('id', (d, i) => `projPoints${i}`)
        .attr('cx', d => this.projPointScale.x(d[0]))
        .attr('cy', d => this.projPointScale.y(d[1]))
        .attr('r', this.circleR)
        .attr('opc', (d, i) => {
          const opc = this.opcScaleNew(0.9 - this.opcScale[this.mode](dataSimilarities[i])) * 0.95 + 0.05
          return opc
        })
        .style('fill', color)
        // .style('fill', (d, i) => {
        //   if (i < 25) {
        //     return '#4e79a7'
        //   } else {
        //     return '#f28e2c'
        //   }
        // })
        // .style('fill-opacity', (d, i) => this.projPointOpacityScale(dataSimilarities[i]))
        .style('fill-opacity', (d, i) => {
          const opc = this.opcScaleNew(0.9 - this.opcScale[this.mode](dataSimilarities[i])) * 0.95 + 0.05
          return opc
          // return 1
        })
      
      if (Data.file === 'Pendigits') {
        g.select('.projPointsG')
          .selectAll('.projPoints')
          .attr('digit', (d, i) => Data.digit[i])
      }
      
      // if (type === 'cap') {
      //   drawSignificantDimText()
      // }
      const dimTextType = type === 'cap' ? 'significant' : 'involved'
      drawDimText(dimTextType)

      function drawDimText(textType) {
        let dimTextG = g.append('g')
          .attr('transform', `translate(${self.boundaryCircle.cx}, ${self.boundaryCircle.cy})`)
        const dims = Data.dims
        let dimLen = Data.dims.length
        let circleCoords = []
        let padding = parseFloat(toPX('0.6rem'))
        let r = self.boundaryCircle.r
        for (let i = 0; i < dimLen; i++) {
          // let dist = i === 0 || i === dimLen / 2 ? 1.35 * padding + r : padding + r
          let dist = padding + r
          if (i === 0) {
            dist = 1.3 * padding + r
          } else if (dimLen % 2 === 0 && i === dimLen / 2) {
            dist = 1.3 * padding + r
          } else if (dimLen % 2 === 1 && (i === Math.ceil(dimLen / 2) - 1 || i === Math.ceil(dimLen / 2))) {
            dist = 1.3 * padding + r
          }
          circleCoords.push([
            dist * Math.sin(Math.PI * 2 / dimLen * i),
            -dist * Math.cos(Math.PI * 2 / dimLen * i)
          ])
        }
        dimTextG.selectAll('.legend_text')
          .data(circleCoords)
          .enter()
          .append('text')
          .attr('class', 'legend_text')
          .attr('id', (d, i) => `legend_text${i}`)
          .attr('x', d => d[0])
          .attr('y', d => d[1])
          .style('dominant-baseline', 'middle')
          .style('font-size', '0.85rem')
          .style('text-anchor', (d, i) => {
            if (i === 0 || i === dimLen / 2) {
              return 'middle'
            } else if (i < dimLen / 2) {
              return 'start'
            } else {
              return 'end'
            }
          })
          .text((d, i) => dims[i])
          .style('opacity', (d, i) => {
            if (textType === 'significant') {
              if (dimDominatingFlag[i] === 0) {
                return 0
              }
            } else if (textType === 'involved') {
              if (dimDominatingFlag[i] === -1) {
                return 0
              }
            }
          })
        
        // targeted modification: small font size
        const smallFontsizeObj = {
          'OD280/OD315 of diluted wines': 0.75,
          'Nonflavanoid phenols': 0.8
        }
        const smallFontsizeDims = Object.keys(smallFontsizeObj)
        dimTextG.selectAll('.legend_text').each(function (p, idx) {
          if (smallFontsizeDims.indexOf(dims[idx]) > -1) {
            d3.select(this).style('font-size', `${smallFontsizeObj[dims[idx]]}rem`)
          }
        })

        if (Data.file === 'Pendigits') {
          dimTextG.selectAll('.legend_text').style('font-size', '0.75rem')
        }

        // targeted modification: linebreak
        const dy = 0.71
        const linebreakObj = {
          'OD280/OD315 of diluted wines': ['OD280/OD315', 'of diluted wines'],
          'Alcalinity of ash': ['Alcalinity of', 'ash']
        }
        const linebreakDims = Object.keys(linebreakObj)
        dimTextG.selectAll('.legend_text').each(function (p, idx) {
          if (linebreakDims.indexOf(dims[idx]) > -1) {
            const splitedDims = linebreakObj[dims[idx]]
            const totalLineHeight = dy * (splitedDims.length - 1)
            let lineHeight = []
            for (let i = 0; i < splitedDims.length; i++) {
              lineHeight.push(-totalLineHeight / 2 + dy * i)
            }
            const text = d3.select(this)
            text.text(null)
              .append('tspan')
              .attr('x', p[0])
              .attr('y', p[1])
              .attr('dy', `${lineHeight[0]}rem`)
              .text(splitedDims[0])
            for (let i = 1; i < splitedDims.length; i++) {
              text.append('tspan')
                .attr('x', p[0])
                .attr('y', p[1])
                .attr('dy', `${lineHeight[i]}rem`)
                .text(splitedDims[i])
            }
          }
        })
      }
      
      function drawDimPoint (p, idx) {
        let drawDim = (vv_g, v_r, color, flag) => {
          let vv_r = flag === 1 ? v_r * 0.3 : v_r * 0.45
          let v_outStrokeWidth = v_r * 0.2
          vv_g.append('circle')
            .attr('class', 'backgroundDimPoint')
            .attr('cx', 0)
            .attr('cy', 0)
            // .attr('r', () => flag === 1 ? vv_r * 2 : vv_r)
            .attr('r', self.getDimPointR('backgroundDimPoint', flag))
            .style('fill', '#fff')
            .style('stroke', '#fff')
            // .style('stroke-width', () => flag === 0 ? 0 : v_outStrokeWidth)
            .style('stroke-width', self.getDimPointStrokeWidth('backgroundDimPoint', flag))
          vv_g.append('circle')
            .attr('class', 'midgroundDimPoint')
            .attr('cx', 0)
            .attr('cy', 0)
            // .attr('r', () => flag === 1 ? vv_r * 2 : vv_r)
            .attr('r', self.getDimPointR('midgroundDimPoint', flag))
            .style('fill', '#fff')
            .style('stroke', () => flag === 1 ? color : 'white')
            // .style('stroke-width', () => flag === 0 ? 0 : v_outStrokeWidth)
            .style('stroke-width', self.getDimPointStrokeWidth('midgroundDimPoint', flag))
          vv_g.append('circle')
            .attr('class', 'foregroundDimPoint')
            .attr('cx', 0)
            .attr('cy', 0)
            // .attr('r', vv_r)
            .attr('r', self.getDimPointR('foregroundDimPoint', flag))
            .style('fill', () => flag === -1 ? 'white' : color)
            // .style('fill-opacity', () => flag === 0 ? 0.6 : 1)
            .style('stroke', () => flag === 1 ? 'none' : color)
            // .style('stroke-width', () => flag === -1 ? v_outStrokeWidth : 0)
            .style('stroke-width', self.getDimPointStrokeWidth('foregroundDimPoint', flag))
        }

        drawDim(d3.select(this), self.dimCircleR, color, dimDominatingFlag[idx])
      }
    },
    checkDimDominating: function (dimWeights, dimCount) {
      const self = this
      let flag = new Array(dimWeights.length).fill(0)
      let threshold = getThreshold(dimCount)
      for (let i = 0; i < dimWeights.length; i++) {
        if (dimWeights[i] >= threshold.high) {
          flag[i] = 1
        } else if (dimWeights[i] <= threshold.low) {
          flag[i] = -1
        }
      }
      return flag

      function getThreshold (dimCount) {
        let lowThreshold = self.dimDominatingThreshold[self.mode].low * dimCount
        let highThreshold = self.dimDominatingThreshold[self.mode].high * dimCount
        return {
          low: lowThreshold < 1 ? 1 : lowThreshold,
          high: highThreshold > dimCount - 1 ? dimCount - 1 : highThreshold
        }
      }
    },
    getDimPointR: function (pointType, dimDominatingFlag) {
      return this.dimPointR[pointType][String(dimDominatingFlag)]
    },
    getDimPointStrokeWidth: function (pointType, dimDominatingFlag) {
      return this.dimPointStrokeWidth[pointType][String(dimDominatingFlag)]
    },
    switchCityProj: function (g, showType, subId) {
      let proj
      if (showType === 'unified') {
        proj = this.unifiedProj
      } else if (showType === 'respective') {
        proj = Data.dataProjs[subId]
      }
      let color = `rgb(${[
        ~~(255 * Data.colors[subId][0]),
        ~~(255 * Data.colors[subId][1]),
        ~~(255 * Data.colors[subId][2])
      ]})`
      let dataWeights = Data.dataWeights[subId]
      let dataSimilarities = numeric.sub(1, dataWeights)
      // this.opcScale.domain(d3.extent(dataSimilarities))

      // let dimWeights = Data.dimWeights[subId]
      let dimDominatingFlag = []
      // let dimDominatingFlag = this.checkDimDominating(dimWeights, Data.subKNN[0].length)
      // let dimDominatingFlag = this.checkDimDominating(dimWeights, Data.dimWeightsExt)
      for (let i = 0; i < Data.subs[subId].length; i++) {
        if (Data.subs[subId][i] === '0') {
          dimDominatingFlag.push(-1)
        } else {
          dimDominatingFlag.push(1)
        }
      }
      let r = this.dimCircleR
      let v_outStrokeWidth = r * 0.2
      g.select('.boundaryCircle')
        .transition()
        .duration(600)
        .style('stroke', color)
      g.selectAll('.projPoints')
        .data(proj)
        .join('circle')
        .transition()
        .duration(600)
        .attr('cx', d => this.projPointScale.x(d[0]))
        .attr('cy', d => this.projPointScale.y(d[1]))
        // .style('fill', color)
        // // .style('fill-opacity', (d, i) => this.projPointOpacityScale(1 - dataWeights[i]))
        // .style('fill-opacity', (d, i) => {
        //   let opc = this.opcScaleNew(0.9 - this.opcScale[this.mode](dataSimilarities[i])) * 0.95 + 0.05
        //   return opc
        // })
        .style('fill', (d, i) => {
          if (i < 25) {
            return '#4e79a7'
          } else {
            return '#f28e2c'
          }
        })
        .style('fill-opacity', (d, i) => {
          // const opc = this.opcScaleNew(0.9 - this.opcScale[this.mode](dataSimilarities[i])) * 0.95 + 0.05
          // return opc
          return 1
        })
      g.selectAll('.backgroundDimPoint')
        .transition()
        .duration(600)
        // .attr('r', (d, i) => dimDominatingFlag[i] === 1 ? r * 0.6 : r * 0.45)
        .attr('r', (d, i) => this.getDimPointR('backgroundDimPoint', dimDominatingFlag[i]))
        // .style('stroke-width', (d, i) => dimDominatingFlag[i] === 0 ? 0 : v_outStrokeWidth)
        .style('stroke-width', (d, i) => this.getDimPointStrokeWidth('backgroundDimPoint', dimDominatingFlag[i]))
      g.selectAll('.midgroundDimPoint')
        .transition()
        .duration(600)
        // .attr('r', (d, i) => dimDominatingFlag[i] === 1 ? r * 0.6 : r * 0.45)
        .attr('r', (d, i) => this.getDimPointR('midgroundDimPoint', dimDominatingFlag[i]))
        .style('stroke', (d, i) => dimDominatingFlag[i] === 1 ? color : 'white')
        // .style('stroke-width', (d, i) => dimDominatingFlag[i] === 0 ? 0 : v_outStrokeWidth)
        .style('stroke-width', (d, i) => this.getDimPointStrokeWidth('midgroundDimPoint', dimDominatingFlag[i]))
      g.selectAll('.foregroundDimPoint')
        .transition()
        .duration(600)
        // .attr('r', (d, i) => dimDominatingFlag[i] === 1 ? r * 0.3 : r * 0.45)
        .attr('r', (d, i) => this.getDimPointR('foregroundDimPoint', dimDominatingFlag[i]))
        .style('fill', (d, i) => dimDominatingFlag[i] === -1 ? 'white' : color)
        .style('stroke', (d, i) => dimDominatingFlag[i] === 1 ? 'none' : color)
        // .style('stroke-width', (d, i) => dimDominatingFlag[i] === -1 ? v_outStrokeWidth : 0)
        .style('stroke-width', (d, i) => this.getDimPointStrokeWidth('foregroundDimPoint', dimDominatingFlag[i]))
      g.selectAll('.legend_text')
        .transition()
        .duration(600)
        .style('opacity', (d, i) => {
          if (dimDominatingFlag[i] === -1) {
            return 0
          } else {
            return 1
          }
        })
    },
    drawGroundTravelLegend: function (g) {
      let legendNum = this.groundTravelLegends.length
      let x = this.width * 0.0125
      let y = this.height / legendNum * 0.008
      g.selectAll('.projLegend')
        .data(this.groundTravelLegends)
        .enter()
        .append('text')
        .attr('class', 'projLegend')
        .attr('x', x)
        .attr('y', (d, i) => this.height / legendNum * i + y)
        .text(d => d)
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
      let mapG  = d3.select('#subMap').select('.SubMapTiling').select('.mapCaps')
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
};
</script>

<style lang="less">
@height: 100%;
@width: 100%;

#subProj {
  height: @height;
  width: @width;

  #subProjSvgContainer {
    overflow-x: auto;
  }

  #switchBtn {
    // float: right;
    // width: 5.75rem;
    width: 100%;
    position: absolute;
    top: 0;
    right: 0;
    visibility: hidden;

    .el-switch {
      right: 10px;
      // right: 0px;
      position: absolute;
    }

    .el-switch__label {
      font-weight: normal;
      // font-size: 0.85rem;
      color: #ccc;
    }

    .el-switch__label * {
      font-size: 0.85rem;
    }

    .el-switch__label.is-active {
      color: #212529;
    }

    .el-button {
      padding: 7px 12px;
      font-size: 0.9rem;
    }

    .el-button:focus {
      outline: none;
    }

    .btnHovered {
      border-color: #409EFF !important;
      background-color: #ecf5ff !important;
      color: #409EFF !important;
    }

    .btnUnhovered {
      border: 1px solid #DCDFE6 !important;
      background-color: #fff !important;
      color: #606266 !important;
    }
  }

  .boundaryCircle {
    stroke-opacity: 0.6;
  }

  .dimPointsG circle {
    opacity: 0.6
  }

  .dimPointsG .backgroundDimPoint {
    opacity: 1 !important;
  }

  .projLegend {
    font-size: 0.9rem;
    text-anchor: start;
    dominant-baseline: hanging;
  }
}
</style>
