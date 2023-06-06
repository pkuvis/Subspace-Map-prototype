<template>
  <div id="main">
    <div id="toolbar">
      <b-navbar id="navbar" toggleable="md" type="dark" variant="info">
        <!-- <b-navbar-toggle target="nav_collapse"></b-navbar-toggle> -->
        <b-navbar-brand href="#">Subspace Map</b-navbar-brand>
        <b-collapse is-nav id="nav_collapse">
          <b-nav-item-dropdown id="my-dropdown" left>
            <template slot="button-content">Data</template>
            <b-dropdown-item v-for="file in fileList" :key="file" @click="changeData(file)">{{file}}</b-dropdown-item>
          </b-nav-item-dropdown>
        </b-collapse>
        <!-- <b-navbar-nav id="popover-nav">
          <b-nav-item>
            <b-button id="popover-target-1">
              Legends for dimension glyphs
            </b-button>
            <b-popover :show.sync="popoverActive" id="legend-popover" target="popover-target-1" triggers="click" placement="top">
              <div id="glyphDiv">
                <svg id="glyphSvg"></svg>
              </div>
            </b-popover>
          </b-nav-item>
        </b-navbar-nav> -->
      </b-navbar>
    </div>
    <section id="subListContainer">
      <SubList></SubList>
    </section>
    <section id="subMapContainer">
      <SubMap></SubMap>
    </section>
    <div id="dimGlyphContainer">
      <svg id="dimGlyphSvg"></svg>
    </div>
    <section id="subProjContainer">
      <SubProj></SubProj>
    </section>
    <LoadingPage></LoadingPage>
  </div>
</template>
<script>
import { mapGetters, mapActions } from 'vuex'
import LoadingPage from '@/components/LoadingPage'
import SubList from '@/components/SubList'
import SubMap from '@/components/SubMap/index'
import SubProj from '@/components/SubProj'
import Color2D from '@/components/color/color2D.js'

// const colormap = require('./color/ziegler.png')
const colormap = require('./color/bremm.png')
const stripe = require('./stripe.png')
export default {
  name: "Main",
  components: {
    LoadingPage,
    SubList,
    SubMap,
    SubProj
  },
  data() {
    return {
      popoverActive: false,
      defaultFile: "Forestfires",
      fileList: ["Forestfires", "Pendigits",],
      changeSubColor: false,

      fanRRatio: 0.95,
      circleRRatio: 1
    };
  },
  mounted() {
    this.$nextTick(() => {
      const self = this
      d3.select(this.$el)
        .select("#my-dropdown")
        .select(".nav-link.dropdown-toggle")
        .style("color", "white")
        .style("opacity", 0.7)
        .style('box-shadow', 'none')
        .style('outline', 'none')
        .on("mouseover", function () {
          d3.select(this).style("opacity", 1)
        })
        .on("mouseout", function () {
          d3.select(this).style("opacity", 0.7)
        })
      
      // let popover = d3.select(this.$el).select('#popover-target-1')
      // popover
      //   .on('mouseover', function () {
      //     d3.select(this)
      //       .style('background-color', '#5a6268')
      //       .style('border-color', '#5a6268')
      //   })
      //   .on('mouseout', function () {
      //     if (!this.popoverActive) {
      //       d3.select(this)
      //         .style('background-color', '#888888')
      //         .style('border-color', '#888888')
      //     }
      //   })
      //   .on('click', function () {
      //     if (this.popoverActive) {
      //       d3.select(this)
      //         .style('background-color', '#888888')
      //         .style('border-color', '#888888')
      //       d3.select('#legend-popover').style('opacity', 0)
      //     } else {
      //       d3.select(this)
      //         .style('background-color', '#5a6268')
      //         .style('border-color', '#5a6268')
      //       setTimeout(() => {
      //         self.drawGlyphLegends()
      //         d3.select('#legend-popover').style('opacity', 1)
      //       }, 150)
      //     }
      //     this.popoverActive = !this.popoverActive
      //   })

      this.loadData(this.defaultFile)

      let resize = () => {
        d3.select('#loading-page').raise().style('display', 'block')
        setTimeout(() => {
          this.updateResize()
          this.drawDimGlyphLegends()
        }, 10)
      }

      window.onresize = resize
    })
  },
  methods: {
    ...mapActions([
      'updateResize'
    ]),
    changeData: function (file) {
      d3.select('#loading-page').raise().style('display', 'block')
      setTimeout(() => {
        this.loadData(file)
      }, 10)
    },
    loadData: function (file) {
      let df = $.Deferred()
      d3.json(`./../../static/data/${file}/result.json`).then(data => {
        Data = data
        Data.file = file
        Data.nationalCaps = []
        Data.provincialCaps = []
        for (let i = 0; i < Data.subtree.children.length; i++) {
          let childI = Data.subtree.children[i]
          Data.nationalCaps.push(childI.data.centerLeafName[0])
          for (let j = 0; j < childI.children.length; j++) {
            let childIJ = childI.children[j]
            let provincialCap = childIJ.data.centerLeafName[0]
            if (Data.nationalCaps.indexOf(provincialCap) === -1) {
              Data.provincialCaps.push(provincialCap)
            }
          }
        }

        // let dimWeights = new Array(Data.subs.length)
        // for (let i = 0; i < dimWeights.length; i++) {
        //   let subI = Data.subs[i]
        //   dimWeights[i] = new Array(Data.dims.length).fill(0)
        //   let thisSubKNN = Data.subKNN[i]
        //   for (let j = 0; j < thisSubKNN.length; j++) {
        //     let subJ = Data.subs[thisSubKNN[j]]
        //     for (let k = 0; k < subI.length; k++) {
        //       if (subI[k] + subJ[k] === '11') {
        //         dimWeights[i][k]++
        //       }
        //     }
        //   }
        // }

        Data.dataWeightsExtent = d3.extent(Data.dataWeights.flat())

        Data.subtree.findByIndex = function (v_clsIDs) {
          if (v_clsIDs == null) {
            return null
          }
          let t_subTree = this
          for (let i = 0; i < v_clsIDs.length; i++) {
            if (t_subTree.children.length == 0 && parseInt(v_clsIDs[i]) == 0) {
              continue
            } else {
              t_subTree = t_subTree.children[v_clsIDs[i]]
            }
          }
          return t_subTree
        }

        // change the subspace color encoding
        // using the 2D colormap
        if (this.changeSubColor) {
          Data.colors = []
          Color2D.ranges = {
            x: d3.extent(Data.subProjs, d => d[0]),
            y: d3.extent(Data.subProjs, d => d[1])
          }
          Color2D.setColormap(colormap, () => {
            for (let i = 0; i < Data.subProjs.length; i++) {
              let color = Color2D.getColor(Data.subProjs[i][0], Data.subProjs[i][1])
              Data.colors.push(color.map(d => d / 255))
            }
            df.resolve()
          })
        } else {
          df.resolve()
        }
      })

      $.when(df).done(() => {
        this.$store.state.loadedData = file
        this.drawDimGlyphLegends()
        console.log('Data:\n', Data)
      })
    },

    drawDimGlyphLegends: function () {
      d3.select('#dimGlyphSvg').selectAll('*').remove()
      let w = parseFloat(d3.select('#dimGlyphContainer').style('width'))
      let h = parseFloat(d3.select('#dimGlyphContainer').style('height')) / 1.25
      let size = Math.min(w, h) - toPX('0.9rem') * 2.5
      let fanR = size / 2 * this.fanRRatio
      let fanInR = fanR * 0.1
      let fanOutR = fanR * 0.9
      let circleR = size / 2 * this.circleRRatio
      d3.select('#dimGlyphSvg')
        .attr('width', w)
        .attr('height', h)
      let svg = d3.select('#dimGlyphSvg').append('g')

      drawFan(fanInR, fanOutR)
      drawCircle(circleR)
      drawDimText(circleR)
      drawLegend()

      function drawFan (inR, outR) {
        const dims = Data.dims
        let g = svg.append('g')
          .attr('transform', `translate(${w / 2}, ${h / 2})`)

        let div = Math.PI * 2 / dims.length
        let fanAngleRatio = 0.3
        let dimArc = d3.arc()
          .outerRadius(outR)
          .innerRadius(inR)
          .startAngle(-div * fanAngleRatio)
          .endAngle(div * fanAngleRatio)
        
        for (let i = 0; i < dims.length; i++) {
          let angle = 360 / dims.length * i
          g.append('g')
            .attr('class', 'legend_dimFan')
            .attr('transform', 'rotate(' + angle + ')')
            .attr('id', `legend_dimFan${i}`)
            .append('path')
              .attr('d', dimArc())
              .attr('fill', '#252525')
        }
      }

      function drawCircle (r) {
        let g = svg.append('g')
          .attr('transform', `translate(${w / 2}, ${h / 2})`)
        let dimLen = Data.dims.length
        let dimR = r * 0.05
        let circleCoords = []
        for (let i = 0; i < dimLen; i++) {
          circleCoords.push([
            r * Math.sin(Math.PI * 2/ dimLen * i),
            -r * Math.cos(Math.PI * 2 / dimLen * i)
          ])
        }

        g.append('circle')
          .attr('class', 'legend_boundaryCircle')
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('r', r)
          .style('stroke-width', r * 0.02)
          .style('stroke', '#252525')
          .style('fill', 'none')
        g.selectAll('.legend_dimPointsG')
          .data(circleCoords)
          .enter()
          .append('g')
          .attr('class', 'legend_dimPointsG')
          .attr('id', (d, i) => `legend_dimPointsG${i}`)
          .attr('transform', d => `translate(${d})`)
          .each(function () {
            let dimG = d3.select(this)
            dimG.append('circle')
              .attr('cx', 0)
              .attr('cy', 0)
              .attr('r', dimR)
              .attr('fill', '#252525')
              // .attr('stroke', '#252525')
              // .attr('stroke-width', dimR * 0.2)
          })
      }

      function drawDimText (r) {
        let g = svg.append('g')
          .attr('transform', `translate(${w / 2}, ${h / 2})`)
        const dims = Data.dims
        let dimLen = Data.dims.length
        let circleCoords = []
        let padding = parseFloat(toPX('0.35rem'))
        for (let i = 0; i < dimLen; i++) {
          // let dist = i === 0 || i === dimLen / 2 ? 2 * padding + r : padding + r
          let dist = padding + r
          if (i === 0) {
            dist = 1.75 * padding + r
          } else if (dimLen % 2 === 0 && i === dimLen / 2) {
            dist = 1.75 * padding + r
          } else if (dimLen % 2 === 1 && (i === Math.ceil(dimLen / 2) - 1 || i === Math.ceil(dimLen / 2))) {
            dist = 1.75 * padding + r
          }
          circleCoords.push([
            dist * Math.sin(Math.PI * 2 / dimLen * i),
            -dist * Math.cos(Math.PI * 2 / dimLen * i)
          ])
        }
        g.selectAll('.legend_text')
          .data(circleCoords)
          .enter()
          .append('text')
          .attr('class', 'legend_text')
          .attr('id', (d, i) => `legend_text${i}`)
          .attr('x', d => d[0])
          .attr('y', d => d[1])
          .style('dominant-baseline', 'middle')
          .style('text-anchor', (d, i) => {
            if (i === 0 || i === dimLen / 2) {
              return 'middle'
            } else if (i < dimLen / 2) {
              return 'start'
            } else {
              return 'end'
            }
          })
          .style('font-size', '0.85rem')
          .text((d, i) => dims[i])
        
        // targeted modification: linebreak
        const dy = 0.71
        const linebreakObj = {
          'OD280/OD315 of diluted wines': ['OD280/OD315', 'of diluted wines'],
          'Alcalinity of ash': ['Alcalinity of', 'ash']
        }
        const linebreakDims = Object.keys(linebreakObj)
        g.selectAll('.legend_text').each(function (p, idx) {
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

      function drawLegend () {
        let g = svg.append('g')
          .attr('transform', `translate(0, ${h})`)
        let rowH = parseFloat(toPX('1rem'))
        let legend_fanR = rowH
        let legend_fanInR = legend_fanR * 0.1
        let legend_fanOutR = legend_fanR * 0.9
        let div = Math.PI / 4
        let fanAngleRatio = 0.3
        let dimArc = d3.arc()
          .outerRadius(legend_fanOutR)
          .innerRadius(legend_fanInR)
          .startAngle(-div * fanAngleRatio)
          .endAngle(div * fanAngleRatio)
        let dimR = rowH / 2 * 0.9
        let stripeW = w / 5
        let stripeTextX = stripeW + rowH / 6

        d3.select('#dimGlyphSvg').attr('height', h + 3 * rowH)
        const dimGlyphContainerH = parseFloat(d3.select('#dimGlyphSvg').style('height'))
        const dimGlyphContainerTop = parseFloat(d3.select('#dimGlyphContainer').style('top'))
        d3.select('#dimGlyphContainer').style('height', dimGlyphContainerH + 'px')
        const viewH = parseFloat(d3.select('#subMapContainer').style('height'))
        d3.select('#subProjContainer')
          .style('top', dimGlyphContainerTop + dimGlyphContainerH + 'px')
          .style('height', viewH - dimGlyphContainerH + 'px')
        
        let col1X = w / 20
        let col2X = w / 2
        let row1 = g.append('g')
        let row1Col1 = row1.append('g')
          .attr('transform', `translate(${col1X}, 0)`)
        let row1Col2 = row1.append('g')
          .attr('transform', `translate(${col2X}, 0)`)
        row1Col1.append('g')
          .attr('transform', `translate(${stripeW / 2}, ${rowH})rotate(45)`)
          // .attr('transform', 'rotate(45)')
          .append('path')
            .attr('d', dimArc())
            .attr('fill', '#252525')
        row1Col1.append('text')
          .attr('x', stripeTextX)
          .attr('y', rowH / 2)
          .style('dominant-baseline', 'middle')
          .style('font-size', '0.8rem')
          .text('Included')
        row1Col2.append('circle')
          .attr('cx', dimR)
          .attr('cy', rowH / 2)
          .attr('r', dimR * 0.7)
          .attr('fill', 'white')
          .attr('stroke', '#252525')
          .attr('stroke-width', dimR * 0.15)
        row1Col2.append('circle')
          .attr('cx', dimR)
          .attr('cy', rowH / 2)
          .attr('r', dimR * 0.325)
          .attr('fill', '#252525')
        row1Col2.append('text')
          .attr('x', dimR * 2)
          .attr('y', rowH / 2)
          .style('dominant-baseline', 'middle')
          .style('font-size', '0.8rem')
          .text('Commonly included')
        
        let row2 = g.append('g')
          .attr('transform', `translate(0, ${rowH})`)
        let row2Col1 = row2.append('g')
          .attr('transform', `translate(${col1X}, 0)`)
        let row2Col2 = row2.append('g')
          .attr('transform', `translate(${col2X}, 0)`)
        row2Col1.append('g')
          .attr('transform', `translate(${stripeW / 2}, ${rowH})rotate(45)`)
          // .attr('transform', 'rotate(45)')
          .append('path')
            .attr('d', dimArc())
            .attr('fill', 'none')
            .attr('stroke-width', legend_fanR / 15)
            .attr('stroke', '#252525')
        row2Col1.append('text')
          .attr('x', stripeTextX)
          .attr('y', rowH / 2)
          .style('dominant-baseline', 'middle')
          .style('font-size', '0.8rem')
          .text('Excluded')
        row2Col2.append('circle')
          .attr('cx', dimR)
          .attr('cy', rowH / 2)
          .attr('r', dimR * 0.55)
          .attr('fill', 'white')
          .attr('stroke', '#252525')
          .attr('stroke-width', dimR * 0.15)
        row2Col2.append('text')
          .attr('x', dimR * 2)
          .attr('y', rowH / 2)
          .style('dominant-baseline', 'middle')
          .style('font-size', '0.8rem')
          .text('Commonly excluded')
        
        let row3 = g.append('g')
          .attr('transform', `translate(0, ${2 * rowH})`)
        let row3Col1 = row3.append('g')
          .attr('transform', `translate(${col1X}, 0)`)
        let row3Col2 = row3.append('g')
          .attr('transform', `translate(${col2X}, 0)`)
        row3Col1.append('image')
          .attr('href', stripe)
          .attr('x', 0)
          .attr('y', 0)
          .attr('height', rowH * 0.9)
          .attr('width', stripeW)
        row3Col1.append('text')
          .attr('x', stripeTextX)
          .attr('y', rowH / 2)
          .style('dominant-baseline', 'middle')
          .style('font-size', '0.8rem')
          .text('Stability')
        row3Col2.append('circle')
          .attr('cx', dimR)
          .attr('cy', rowH / 2)
          .attr('r', dimR * 0.45)
          .attr('fill', '#252525')
        row3Col2.append('text')
          .attr('x', dimR * 2)
          .attr('y', rowH / 2)
          .style('dominant-baseline', 'middle')
          .style('font-size', '0.8rem')
          .text('Normal')
      }
    },
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="less">
@navbar-height: 2.25rem;
@view-height: ~"calc(100% - @{navbar-height})";
// @view-height: ~"calc(100% - @{navbar-height} - @{border-size})";
@border-size: 1px;
@subList-raw-width: 20%;
@subList-real-width: ~"calc(@{subList-raw-width} - @{border-size})";
@subMap-raw-width: 60%;
@subMap-real-width: ~"calc(@{subMap-raw-width} - @{border-size})";
@subProj-left: @subList-raw-width + @subMap-raw-width;
@subProj-width: 100% - @subProj-left;
@dimGlyph-height: 24%;
@subProj-top: ~"calc(@{navbar-height} + @{dimGlyph-height})";
@subProj-height: ~"calc(@{view-height} - @{dimGlyph-height})";

#main {
  position: absolute;
  width: 100%;
  height: 100%;
  // border-width: 0 @border-size @border-size @border-size;
  border-width: 0;
  border-style: solid;
  border-color: #cccccc;
  box-sizing: border-box;
  overflow-y: hidden;
}

#navbar {
  height: @navbar-height;
  #my-dropdown:focus, #my-dropdown:active, .show {
    -webkit-box-shadow: none !important;
    box-shadow: none !important;
    outline: none !important;
  }

  .btn-secondary {
    background-color: #888888;
    border-color: #888888;
  }
  // .btn-secondary:active, .btn-secondary.active {
  //   background-color: #5a6268;
  //   border-color: #5a6268;
  // }

  #popover-nav {
    position: absolute;
    right: 100% - @subProj-left;
  }
}

#subListContainer {
  position: absolute;
  left: 0px;
  top: @navbar-height;
  height: @view-height;
  width: @subList-real-width;
  border-width: 0px @border-size 0px 0px;
  border-style: solid;
  border-color: #cccccc;
  box-sizing: border-box;
}

#subMapContainer {
  position: absolute;
  left: @subList-raw-width;
  top: @navbar-height;
  height: @view-height;
  width: @subMap-real-width;
  border-width: 0px @border-size 0px 0px;
  border-style: solid;
  border-color: #cccccc;
  box-sizing: border-box;
}

#dimGlyphContainer {
  position: absolute;
  left: @subProj-left;
  // top: @navbar-height;
  top: 43px;
  height: @dimGlyph-height;
  width: @subProj-width;
}

#subProjContainer {
  position: absolute;
  left: @subProj-left;
  // top: @navbar-height;
  top: @subProj-top;
  // height: @view-height;
  height: @subProj-height;
  width: @subProj-width;
}

.bg-info {
  background-color: #888888 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

.dropdown-menu {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

.dropdown-menu-left {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  font-size: 0.5em !important;
}

.navbar-text {
  color: rgb(255, 255, 255);
  margin-left: 30px;
}

li {
  list-style-type: none;
}
</style>
