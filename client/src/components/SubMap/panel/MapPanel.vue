<template>
  <div id="mapPanel">
    <el-row>
      <el-col>
        <div class="mapPanelContent">
          Legends
        </div>
      </el-col>
    </el-row>
    <template v-for="legend in legends">
      <el-row class="mapLegend" :key="legend">
        <el-col :span="4">
          <div class="mapLegendIcon"></div>
        </el-col>
        <el-col :span="20">
          <div class="mapLegendContent" v-html="legend"></div>
        </el-col>
      </el-row>
    </template>
    <el-row>
      <el-col>
        <div class="mapPanelContent">
          Exploration mode
        </div>
      </el-col>
    </el-row>
    <div class="mapMode" v-for="(mode, idx) in modes" :key="mode">
      <el-radio-group v-model="currMode" @change="changeMode">
        <el-radio :label="mode">{{modeTexts[idx]}}</el-radio>
      </el-radio-group>
    </div>
    <el-row>
      <el-col>
        <div class="mapPanelContent">
          Scale
        </div>
      </el-col>
    </el-row>
    <div class="mapScale">
      <div class="mapScaleBtnGroup">
        <div class="mapScaleBtn" id="mapScaleBtnPlus">
          <el-button plain icon="el-icon-plus" size="mini" :disabled="currScaleLevel===2" @click="changeScale('plus')"></el-button>
        </div>
        <div class="mapScaleBtn" id="mapScaleBtnMinus">
          <el-button plain icon="el-icon-minus" size="mini" :disabled="currScaleLevel===0"  @click="changeScale('minus')"></el-button>
        </div>
      </div>
      <div class="mapScaleText" v-html="scaleLevel[currScaleLevel]"></div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
export default {
  name: 'SubPanel',
  data() {
    return {
      // legends: ['National&nbsp;capital', 'Provincial&nbsp;capital', 'Harbor', 'Land&nbsp;route'],
      legends: ['National&nbsp;capital', 'Provincial&nbsp;capital', 'Land&nbsp;route', 'Sea&nbsp;route'],
      currMode: 'browse',
      modes: ['browse', 'airTravel', 'groundTravel'],
      modeTexts: ['Browse', 'Travel in the air', 'Travel on the ground'],
      currScaleLevel: 0,
      scaleLevel: {
        0: "National level",
        1: "Provincial level",
        2: "Urban level"
      }
    }
  },
  mounted() {
    this.$nextTick(function () {
      // d3.select(this.$el).style('visibility', 'hidden')
      this.drawLegendIcon()

      let panelWidth = parseFloat(d3.select(this.$el).style('width'))

      let btnGroupHeight = parseFloat(d3.select(this.$el).select('.mapScaleBtnGroup').style('height'))
      let scaleTextHeight = parseFloat(d3.select(this.$el).select('.mapScaleText').style('height'))
      d3.select(this.$el).select('.mapScaleText').style('top', (btnGroupHeight - scaleTextHeight) / 2 + 'px')
      let btnWidth = parseFloat(d3.select(this.$el).select('.mapScaleBtnGroup').select('button').style('width'))
      d3.select(this.$el).select('.mapScaleText').style('left', btnWidth + panelWidth / 17.5 + 'px')
      d3.select(this.$el)
        .select('.mapScaleBtnGroup')
        .selectAll('button')
        .on('mouseover', function () {
          d3.select(this)
            .classed('mapScaleBtnHovered', true)
            .classed('mapScaleBtnUnhovered', false)
        })
        .on('mouseout', function () {
          d3.select(this)
            .classed('mapScaleBtnHovered', false)
            .classed('mapScaleBtnUnhovered', true)
        })

      // let panelHeight = parseFloat(d3.select(this.$el).style('height'))
      // let subMapHeight = parseFloat(d3.select(d3.select(this.$el).node().parentElement).style('height'))
      // let panelTop = subMapHeight - panelHeight - panelWidth / 30
      // d3.select(this.$el).style('top', panelTop + 'px')

      // d3.select(this.$el).style('visibility', 'visible')
    })
  },
  computed: {
    ...mapGetters([
      'updateMap',
      'changeLevelByMap'
    ])
  },
  watch: {
    updateMap: () => {
      d3.select('#mapPanel').style('visibility', 'visible')
    },
    changeLevelByMap: function (newVal) {
      let currLevel
      if (newVal.level === undefined) {
        currLevel = 2
      } else {
        currLevel = newVal.level
      }
      this.currScaleLevel = currLevel
    }
  },
  methods: {
    ...mapActions([
      'updateChangeLevelByPanel',
      'updateChangeMode'
    ]),
    changeMode (newVal) {
      this.updateChangeMode({
        mode: newVal
      })
    },
    changeScale (type) {
      // d3.event.stopPropagation()
      if (type === 'plus') {
        this.currScaleLevel += 1
        this.updateChangeLevelByPanel({
          level: this.currScaleLevel
        })
      } else if (type === 'minus') {
        this.currScaleLevel -= 1
        this.updateChangeLevelByPanel({
          level: this.currScaleLevel
        })
      }
    },
    drawLegendIcon () {
      this.d3el = d3.select(this.$el)
      const self = this
      let size = Math.min(
        this.d3el.select('.mapLegend').node().getBoundingClientRect().width,
        this.d3el.select('.mapLegend').node().getBoundingClientRect().height
      )
      this.d3el.selectAll('.mapLegendIcon').each(function (p, idx) {
        let thisIcon = d3.select(this)
        let thisIconSvg = thisIcon
          .append('svg')
          .attr('width', size)
          .attr('height', size)
        switch (self.legends[idx]) {
          case 'National&nbsp;capital':
            drawNationalCap(thisIconSvg, size)
            break
          case 'Provincial&nbsp;capital':
            drawProvincialCap(thisIconSvg, size)
            break
          case 'Harbor':
            drawHarbor(thisIconSvg, size)
            break
          case 'Land&nbsp;route':
            drawLandRoute(thisIconSvg, size)
            break
          case 'Sea&nbsp;route':
            drawSeaRoute(thisIconSvg, size)
            break
        }
      })
      function drawNationalCap (v_svg, size) {
        let g = v_svg.append('g')
          .attr('transform', `translate(${size / 2}, ${size / 2})`)
        let r = size / 2
        let inR = r * 0.3,
          outR = r * 0.6,
          outStrokeWidth = r * 0.2
        g.append('circle')
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('r', outR)
          .style('fill', '#fff')
          .style('stroke', '#000')
          .style('stroke-width', outStrokeWidth)
        g.append('circle')
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('r', inR)
          .style('fill', '#000')
      }
      function drawProvincialCap (v_svg, size) {
        let g = v_svg.append('g')
          .attr('transform', `translate(${size / 2}, ${size / 2})`)
        let r = size / 2 * 0.45,
          outStrokeWidth = size / 2 * 0.2
        g.append('circle')
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('r', r)
          .style('fill', '#fff')
          .style('stroke', '#000')
          .style('stroke-width', outStrokeWidth)
      }
      function drawHarbor (v_svg, size) {
        let icon = 'M512 0C375.467 0 273.067 106.974 273.067 238.933a238.387 238.387 0 0 0 170.666 227.874V879.07c-63.488-11.264-128-37.547-180.77-86.699C191.078 725.47 136.67 618.974 136.67 443.597a68.267 68.267 0 1 0-136.67 0C0 648.602 69.086 798.31 169.984 892.245 270.882 986.25 398.541 1024 512 1024c113.732 0 241.323-38.23 342.153-132.437s169.71-243.917 169.71-447.966c4.438-95.232-140.834-95.232-136.396 0 0 174.285-54.614 280.917-126.498 348.16-52.839 49.288-117.283 75.776-180.702 87.176V467.081a238.524 238.524 0 0 0 170.666-228.148C750.933 106.973 648.533 0 512 0z m0 136.533a102.4 102.4 0 1 1 0 204.8 102.4 102.4 0 0 1 0-204.8z'
        let scale = 0.012
        let g = v_svg.append('g')
          .attr('transform', `translate(${size / 2}, ${size / 2})scale(${scale})`)
          .style('opacity', 0)
        g.append('path')
          .attr('d', icon)
        let gSize = g.node().getBoundingClientRect()
        g.attr('transform', function () {
          return getNewHarborCoords(g, gSize)
        })
        .style('opacity', 1)
        function getNewHarborCoords (thisHarbor, gSize) {
          let prevTranslate = [size / 2, size / 2]
          let newTranslate = [prevTranslate[0] - gSize.width / 2, prevTranslate[1] - gSize.height / 2]
          return `translate(${newTranslate})scale(${scale})`
        }
      }
      function drawLandRoute (v_svg, size) {
        let lineLength = size * 0.7
        let startX = (size - lineLength) / 2
        let line = [[startX, size / 2], [startX + lineLength, size / 2]]
        let g = v_svg.append('g')
          .append('path')
          .attr('d', d3.line()(line))
          .style('stroke', '#5a5a5a')
          .style('fill', 'none')
          .style('stroke-width', size / 9)
      }
      function drawSeaRoute (v_svg, size) {
        let lineLength = size * 1
        let startX = (size - lineLength) / 2
        let line = [[startX, size / 2], [startX + lineLength, size / 2]]
        let g = v_svg.append('g')
          .append('path')
          .attr('d', d3.line()(line))
          .style('stroke', '#5a5a5a')
          .style('fill', 'none')
          .style('stroke-width', size / 10)
          .style('stroke-dasharray', 4)
      }
    }
  }
}

</script>

<style lang="less">
// @panel-height: 100%;
@panel-height: 18rem;
@panel-width: 10.75rem;
@projMap-width: 93%;

#mapPanel {
  text-align: left;
  position: absolute;
  padding-left: 0.5rem;
  bottom: 0;
  right: 0;
  width: @panel-width;
  height: @panel-height;
  background-color: rgba(102,102,102,0.1);
  visibility: hidden;

  .mapPanelContent {
    margin-top: 0.25rem;
    font-style: italic;
    font-weight: 600;
  }

  .mapLegend,
  .mapMode,
  .mapScaleText {
    font-size: 0.9rem;
  }

  .mapMode {
    text-align: left;
    label {
      margin-bottom: 0px;
    }
  }

  .mapScale {
    position: relative;
  }

  .mapScaleBtnGroup {
    line-height: 1;
    font-weight: 1000;
  }

  .mapScaleBtn button {
    padding: 0.25rem;
  }

  .mapScaleBtn button:focus {
    outline: none !important;
  }

  .mapScaleBtnHovered {
    border-color: #409EFF !important;
    color: #409EFF !important;
  }

  .mapScaleBtnUnhovered {
    border: 1px solid #DCDFE6 !important;
    color: #606266 !important;
  }

  .mapScaleText {
    position: absolute;
  }
}

// #projMap {
//   width: @projMap-width;
//   border: 1px solid #ccc;
// }
</style>
