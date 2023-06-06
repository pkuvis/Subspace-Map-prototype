import Graph from './graph.js'
import { Graph as MST, Kruskal } from './mst.js'
import { ShapeInfo, Intersection } from "@/../node_modules/kld-intersections/dist/index-esm.js"
import { saveAs } from 'file-saver'

class Route {
  constructor (leafNodes, gridScales, data) {
    const self = this

    if (data === undefined) {
      this.nearestSeaRoute = false
      // sea route construction: 基于坐标计算两个聚类cap之间的直线距离，找到最近的k_c个cap-cap pair
      this.kc = 3
      // sea route construction: 每个cap找到最近的$k_s$个boundary subspaces
      this.ks = 10
      this.leafNodes = leafNodes
      this.gridScales = gridScales
      this.cls = []
      for (let i = 0; i < Data.subHierClusters.length; i++) {
        if (Array.isArray(Data.subHierClusters[i])) {
          this.cls.push([].concat(...Data.subHierClusters[i]))
        }
      }
      this.distMat = Data.subDistMat
      this.caps = []
      for (let i = 0; i < Data.subtree.children.length; i++) {
        let childI = Data.subtree.children[i]
        this.caps.push([])
        this.caps[i].push(childI.data.centerLeafName[0])
        for (let j = 0; j < childI.children.length; j++) {
          let childIJ = childI.children[j]
          let cap = childIJ.data.centerLeafName[0]
          this.caps[i].push(cap)
        }
      }
      // this.initShapeInfo(gridScales)
      this.initShapeInfo(gridScales, 0.0015)
      this.init(gridScales)
      // this.saveRes()
    } else {
      for (const key in data) {
        if (key === 'landSubCoords') { // Map structure
          this[key] = new Map()
          for (const item of data[key]) {
            this[key].set(item[0], item[1])
          }
        } else {
          this[key] = data[key]
        }
      }
    }
  }

  initShapeInfo (gridScales, expansion = 0) {
    let g = d3.select('#subMap').select('.SubMapTiling')
    this.shapes = []
    // first cluster shape
    for (let i = 0; i < Data.nationalCaps.length; i++) {
      let center = g.select(`.SubCls_${i}`).data()[0].center
      let points = g.select(`.SubCls_${i}`).data()[0].paths[0].points
      let path = getPathFromPoints(center, points, gridScales, expansion)
      this.shapes.push(ShapeInfo.path(d3.line()(path)))
    }
    // then outlier shape
    for (let i = 0; i < Data.subtree.leaves.length; i++) {
      let leaf = Data.subtree.leaves[i]
      let edges = Array.from(g.selectAll('.SubMapGrids').filter(function () {
        return d3.select(this).attr('index') === String(leaf)
      }).data()[0].edges._c.values())
      let lines = getLinesFromEdges(edges, gridScales, expansion)
      for (let i = 0; i < lines.length; i++) {
        this.shapes.push(ShapeInfo.line(lines[i].flat()))
      }
    }

    function getPathFromPoints (center, points, scales, expansion) {
      let path = []
      let xRangeDiff = scales.x.range()[1] - scales.x.range()[0]
      let yRangeDiff = scales.y.range()[1] - scales.y.range()[0]
      for (let i = 0; i < points.length; i++) {
        let [origX, origY] = bScale(scales, [points[i].coordinates.x, points[i].coordinates.y])
        let x = origX < center[0] ? (origX - xRangeDiff * expansion) : (origX + xRangeDiff * expansion)
        let y = origY < center[1] ? (origY - yRangeDiff * expansion) : (origY + yRangeDiff * expansion)
        path.push([x, y])
      }
      return path
    }

    function getLinesFromEdges (edges, scales, expansion) {
      let lines = []
      for (let i = 0; i < edges.length; i++) {
        lines.push([
          bScale(scales, [edges[i].start.coordinates.x, edges[i].start.coordinates.y]),
          bScale(scales, [edges[i].end.coordinates.x, edges[i].end.coordinates.y])
        ])
      }
      return lines
    }
  }

  init (gridScales) {
    this.harborIcon = 'M512 0C375.467 0 273.067 106.974 273.067 238.933a238.387 238.387 0 0 0 170.666 227.874V879.07c-63.488-11.264-128-37.547-180.77-86.699C191.078 725.47 136.67 618.974 136.67 443.597a68.267 68.267 0 1 0-136.67 0C0 648.602 69.086 798.31 169.984 892.245 270.882 986.25 398.541 1024 512 1024c113.732 0 241.323-38.23 342.153-132.437s169.71-243.917 169.71-447.966c4.438-95.232-140.834-95.232-136.396 0 0 174.285-54.614 280.917-126.498 348.16-52.839 49.288-117.283 75.776-180.702 87.176V467.081a238.524 238.524 0 0 0 170.666-228.148C750.933 106.973 648.533 0 512 0z m0 136.533a102.4 102.4 0 1 1 0 204.8 102.4 102.4 0 0 1 0-204.8z'
    this.harborIconScale = 0.005
    this.initLandRoute(gridScales)
    this.initBoundaryGraph()
    this.initWaterRoute(gridScales)
    // Add the land routes constructed by the harbor
    this.addLandRoute(gridScales)
    this.splitLandRoute()
    this.combineLandRoute()
    this.getLandSubCoords()
  }

  saveRes () {
    const blob = new Blob([JSON.stringify(this)], {type: "text/plain;charset=utf-8"})
    saveAs(blob, `route.json`)
  }

  initLandRoute (gridScales) {
    this.landGraph = []
    this.landRoute = []
    this.landMST = []
    this.landRouteCoords = []

    for (let i = 0; i < this.cls.length; i++) {
      let subCls = this.cls[i]
      let graph = {}
      for (let j = 0; j < subCls.length; j++) {
        let sub = subCls[j]
        let node = this.leafNodes.find(node => node.ID === sub)
        let neighborPositions = Array.from(node.neighbors.values())
        let neighborNodes = {}
        for (let k = 0; k < neighborPositions.length; k++) {
          let neighborNode = this.leafNodes.find(node => JSON.stringify(Object.values(node.position)) === JSON.stringify(neighborPositions[k]))
          if (neighborNode !== undefined) {
            neighborNodes[neighborNode.ID] = this.distMat[sub][neighborNode.ID]
          }
        }
        graph[sub] = neighborNodes
      }
      this.landGraph.push(new Graph(graph))
      let route = {}
      for (let j = 0; j < this.caps[i].length; j++) {
        for (let k = j + 1; k < this.caps[i].length; k++) {
          route[[this.caps[i][j], this.caps[i][k]]] = this.landGraph[i].findShortestPath(this.caps[i][j], this.caps[i][k]).map(Number)
        }
      }
      let vertexes = []
      let edges = []
      for (let j = 0; j < this.caps[i].length; j++) {
        vertexes.push({id: this.caps[i][j]})
        for (let k = j + 1; k < this.caps[i].length; k++) {
          edges.push({
            u: this.caps[i][j],
            v: this.caps[i][k],
            w: route[[this.caps[i][j], this.caps[i][k]]].length
          })
        }
      }
      let mstGraph = MST()
      mstGraph.initVertex(vertexes)
      mstGraph.storageEdge(edges)
      this.landMST[i] = Kruskal(mstGraph)
      this.landRoute[i] = {}
      this.landRouteCoords.push([])
      for (let j = 0; j < this.landMST[i].length; j++) {
        this.landRouteCoords[i].push([])
        let thisRoute = route[[this.landMST[i][j].u, this.landMST[i][j].v]]
        this.landRoute[i][[this.landMST[i][j].u, this.landMST[i][j].v]] = thisRoute
        for (let k = 0; k < thisRoute.length; k++) {
          let node = this.leafNodes.find(node => node.ID === thisRoute[k])
          // this.landRouteCoords[i][j].push(node.center.coordinates)
          this.landRouteCoords[i][j].push({
            x: gridScales.x(node.center.coordinates.x),
            y: gridScales.y(node.center.coordinates.y)
          })
        }
      }
    }
  }

  initBoundaryGraph () {
    const self = this
    const leafNodes = this.leafNodes
    const cls = this.cls

    const occupiedPositions = getOccupiedPositions()
    const positionRange = getPositionRange(occupiedPositions)
    const emptyPositions = getEmptyPositions(positionRange, occupiedPositions)
    this.emptyPositions = emptyPositions
    const clusterBoundarySubs = this._boundarySubs()
    this.clusterBoundarySubs = JSON.parse(JSON.stringify(clusterBoundarySubs))
    // const clusterBoundaryPositions = getClusterBoundaryPositions()
    let clusterBoundaryPositions = this._boundarySubPositions()
    this.clusterBoundaryPositions = JSON.parse(JSON.stringify(clusterBoundaryPositions))
    clusterBoundaryPositions = clusterBoundaryPositions.flat()
    const positions = emptyPositions.concat(clusterBoundaryPositions)

    let graph = {}
    for (let position of positions) {
      let neighborNodes = {}
      const neighborPositions = getAvaliableNeighborPositions(position, emptyPositions)
      for (let neighborPosition of neighborPositions) {
        neighborNodes[String(neighborPosition)] = this._neighborManhattanDist(position, neighborPosition)
      }
      graph[String(position)] = neighborNodes
    }

    this.boundaryGraph = new Graph(graph)

    function getOccupiedPositions () {
      let occupiedPositions = []

      for (let i = 0; i < leafNodes.length; i++) {
        occupiedPositions.push(Object.values(leafNodes[i].position))
      }

      return occupiedPositions
    }

    function getPositionRange (occupiedPositions) {
      const xRange = d3.extent(occupiedPositions, d => d[0])
      const yRange = d3.extent(occupiedPositions, d => d[1])

      return [
        // [xRange[0] - 1, xRange[1] + 1],
        // [yRange[0] - 1, yRange[1] + 1]
        xRange, yRange
      ]
    }

    function getEmptyPositions (positionRange, occupiedPositions) {
      let emptyPositions = []

      for (let i = positionRange[0][0]; i < positionRange[0][1]; i++) {
        for (let j = positionRange[1][0]; j < positionRange[1][1]; j++) {
          if (!self._arrayAlreadyHasArray(occupiedPositions, [i, j])) {
            emptyPositions.push([i, j])
          }
        }
      }

      return emptyPositions
    }

    function getClusterBoundaryPositions () {
      let clusterBoundaryPositions = []

      for (let subCls of cls) {
        for (let sub of subCls) {
          let node = leafNodes.find(node => node.ID === sub)
          let nodePos = Object.values(node.position)
          let neighborPositions = Array.from(node.neighbors.values())
          for (let neighborPosition of neighborPositions) {
            let neighborNode = leafNodes.find(node => JSON.stringify(Object.values(node.position)) === JSON.stringify(neighborPosition))
            if (neighborNode === undefined) {
              clusterBoundaryPositions.push(nodePos)
              continue
            }
          }
        }
      }

      clusterBoundaryPositions = clusterBoundaryPositions.map(JSON.stringify).reverse().filter(function (e, i, a) {
        return a.indexOf(e, i + 1) === -1
      }).reverse().map(JSON.parse)

      return clusterBoundaryPositions
    }

    function getAvaliableNeighborPositions (position, emptyPositions) {
      const neighborPositions = getNeighborPositions(position)
      let avaliableNeighbors = []

      for (let neighborPosition of neighborPositions) {
        if (self._arrayAlreadyHasArray(emptyPositions, neighborPosition)) { // empty grid
          avaliableNeighbors.push(neighborPosition)
        }
      }

      return avaliableNeighbors
    }

    function getNeighborPositions (pos) {
      let intPos = { i: pos[0], j: pos[1] }
      let neighbors = []
      let x0, x1, x2, x3
      if (intPos.j % 2 === 0) {
        x0 = 1
        x1 = (intPos.i >= 0) ? 1 : 0
        x2 = (intPos.i <= 0) ? -1 : 0
        x3 = -1
      } else {
        x0 = (intPos.i === -1) ? 2 : 1
        x1 = (intPos.i < 0) ? 1 : 0
        x2 = (intPos.i > 0) ? -1 : 0
        x3 = (intPos.i === 1) ? -2 : -1
      }
      // 方向：右、右下、左下、左、左上、右上
      neighbors.push([intPos.i + x0, intPos.j])
      neighbors.push([intPos.i + x1, intPos.j + 1])
      neighbors.push([intPos.i + x2, intPos.j + 1])
      neighbors.push([intPos.i + x3, intPos.j])
      neighbors.push([intPos.i + x2, intPos.j - 1])
      neighbors.push([intPos.i + x1, intPos.j - 1])
      return neighbors
    }
  }

  initWaterRoute (gridScales) {
    const self = this
    this.waterGraph = {}
    this.waterMST = null
    this.waterRoute = {}
    this.waterRouteCoords = {}
    // harbor是地图上的city
    // harborCityPos是对应city的pos
    // harborPos是harbor邻居中找到的一个海上的位置
    this.harbor = []
    this.harborCityPos = []
    this.harborPos = []
    this.harborCoords = []
    this.harborRouteCorrespondence = []
    this.seaGraph = []
    this.seaRoutePos = []
    this.seaRouteOD = []
    this.seaRouteCoords = []

    let route = {}
    let routeDist = {}

    // // 根据相似度来算route
    // for (let i = 0; i < this.landGraph.length; i++) {
    //   let graphI = copy2dObj(this.landGraph[i].map)
    //   let boundarySubsI = getBoundarySubs(graphI)
    //   for (let j = i + 1; j < this.landGraph.length; j++) {
    //     let graphJ = copy2dObj(this.landGraph[j].map)
    //     let boundarySubsJ = getBoundarySubs(graphJ)
    //     let graphIJ = extendObj(graphI, graphJ)
    //     for (let ii = 0; ii < boundarySubsI.length; ii++) {
    //       let boundarySubI = boundarySubsI[ii]
    //       for (let jj = 0; jj < boundarySubsJ.length; jj++) {
    //         let boundarySubJ = boundarySubsJ[jj]
    //         graphIJ[boundarySubI][boundarySubJ] = this.distMat[boundarySubI][boundarySubJ]
    //         graphIJ[boundarySubJ][boundarySubI] = this.distMat[boundarySubI][boundarySubJ]
    //       }
    //     }
    //     this.waterGraph[[i, j]] = new Graph(graphIJ)
    //     // route[[i, j]] = this.waterGraph[[i, j]].findShortestPath(Data.nationalCaps[i], Data.nationalCaps[j]).map(Number)
    //     let shortestCapitalPair = getShortestCapPair(i, j)
    //     route[[i, j]] = this.waterGraph[[i, j]].findShortestPath(...shortestCapitalPair).map(Number)
    //   }
    // }

    // // 根据坐标距离来算route v1
    // let graphs = []
    // for (let i = 0; i < this.cls.length; i++) {
    //   let subCls = this.cls[i]
    //   let graph = {}
    //   for (let j = 0; j < subCls.length; j++) {
    //     let sub = subCls[j]
    //     let node = this.leafNodes.find(node => node.ID === sub)
    //     let nodePos = Object.values(node.position)
    //     let nodeCoords = getCoords(nodePos, gridScales)
    //     let neighborPositions = Array.from(node.neighbors.values())
    //     let neighborNodes = {}
    //     for (let k = 0; k < neighborPositions.length; k++) {
    //       let neighborNode = this.leafNodes.find(node => JSON.stringify(Object.values(node.position)) === JSON.stringify(neighborPositions[k]))
    //       if (neighborNode !== undefined) {
    //         let neighborCoords = getCoords(neighborPositions[k], gridScales)
    //         // neighborNodes[neighborNode.ID] = euclideanDist(nodeCoords, neighborCoords)
    //         neighborNodes[neighborNode.ID] = manhattanDist(nodePos, neighborPositions[k])
    //       }
    //     }
    //     graph[sub] = neighborNodes
    //   }
    //   graphs.push(new Graph(graph))
    // }
    // for (let i = 0; i < graphs.length; i++) {
    //   let graphI = copy2dObj(graphs[i].map)
    //   let boundarySubsI = getBoundarySubs(graphI)
    //   for (let j = i + 1; j < graphs.length; j++) {
    //     let graphJ = copy2dObj(graphs[j].map)
    //     let boundarySubsJ = getBoundarySubs(graphJ)
    //     let graphIJ = extendObj(graphI, graphJ)
    //     for (let ii = 0; ii < boundarySubsI.length; ii++) {
    //       let boundarySubI = boundarySubsI[ii]
    //       let boundarySubIPos = getSubPos(Number(boundarySubI))
    //       let boundarySubICoords = getCoords(boundarySubIPos, gridScales)
    //       for (let jj = 0; jj < boundarySubsJ.length; jj++) {
    //         let boundarySubJ = boundarySubsJ[jj]
    //         let boundarySubJPos = getSubPos(Number(boundarySubJ))
    //         let boundarySubJCoords = getCoords(boundarySubJPos, gridScales)
    //         // let dist = euclideanDist(boundarySubICoords, boundarySubJCoords)
    //         let dist = manhattanDist(boundarySubIPos, boundarySubJPos)
    //         graphIJ[boundarySubI][boundarySubJ] = dist
    //         graphIJ[boundarySubJ][boundarySubI] = dist
    //       }
    //     }
    //     this.waterGraph[[i, j]] = new Graph(graphIJ)
    //     // route[[i, j]] = this.waterGraph[[i, j]].findShortestPath(Data.nationalCaps[i], Data.nationalCaps[j]).map(Number)
    //     let shortestCapitalPair = getShortestCapPair(i, j)
    //     route[[i, j]] = this.waterGraph[[i, j]].findShortestPath(...shortestCapitalPair).map(Number)
    //   }
    // }

    // // 根据坐标距离来算route v2
    let graphs = []
    for (let i = 0; i < this.cls.length; i++) {
      let subCls = this.cls[i]
      let graph = {}
      for (let j = 0; j < subCls.length; j++) {
        let sub = subCls[j]
        let node = this.leafNodes.find(node => node.ID === sub)
        let nodePos = Object.values(node.position)
        let neighborPositions = Array.from(node.neighbors.values())
        let neighborNodes = {}
        for (let k = 0; k < neighborPositions.length; k++) {
          let neighborNode = this.leafNodes.find(node => JSON.stringify(Object.values(node.position)) === JSON.stringify(neighborPositions[k]))
          if (neighborNode !== undefined) {
            neighborNodes[neighborNode.ID] = this._neighborManhattanDist(nodePos, neighborPositions[k])
          }
        }
        graph[sub] = neighborNodes
      }
      graphs.push(new Graph(graph))
    }

    // let date1 = new Date()

    // for (let i = 0; i < graphs.length; i++) {
    //   let graphI = copy2dObj(graphs[i].map)
    //   // let boundarySubsI = getBoundarySubs(graphI)
    //   const boundarySubsI = this.clusterBoundarySubs[i]
    //   for (let j = i + 1; j < graphs.length; j++) {
    //     let graphJ = copy2dObj(graphs[j].map)
    //     // let boundarySubsJ = getBoundarySubs(graphJ)
    //     const boundarySubsJ = this.clusterBoundarySubs[j]
    //     let graphIJ = extendObj(graphI, graphJ)
    //     for (let ii = 0; ii < boundarySubsI.length; ii++) {
    //       let boundarySubI = boundarySubsI[ii]
    //       // let boundarySubIPos = getSubPos(Number(boundarySubI))
    //       const boundarySubIPos = this.clusterBoundaryPositions[i][ii]
    //       for (let jj = 0; jj < boundarySubsJ.length; jj++) {
    //         let boundarySubJ = boundarySubsJ[jj]
    //         // let boundarySubJPos = getSubPos(Number(boundarySubJ))
    //         const boundarySubJPos = this.clusterBoundaryPositions[j][jj]
    //         let dist = this._boundarySubManhattanDist(boundarySubIPos, boundarySubJPos)
    //         graphIJ[boundarySubI][boundarySubJ] = dist
    //         graphIJ[boundarySubJ][boundarySubI] = dist
    //       }
    //     }
    //     this.waterGraph[[i, j]] = new Graph(graphIJ)
    //     // let shortestCapitalPair = getShortestCapPair(i, j)
    //     // route[[i, j]] = this.waterGraph[[i, j]].findShortestPath(...shortestCapitalPair).map(Number)
    //     const routeInfo = this._shortestPathBetweenCapPair(i, j)
    //     route[[i, j]] = routeInfo.route
    //     routeDist[[i, j]] = routeInfo.dist
    //   }
    // }

    const nearestCapPair = this._nearestCapPair()
    const uniqueCaps = this._capsInNearestCapPair(nearestCapPair)
    const capNearestBoundarySubs = this._capNearestBoundarySubs(uniqueCaps)
    for (let i = 0; i < graphs.length; i++) {
      let graphI = copy2dObj(graphs[i].map)
      for (let j = i + 1; j < graphs.length; j++) {
        let graphJ = copy2dObj(graphs[j].map)
        let graphIJ = extendObj(graphI, graphJ)
        for (const thisCapPair of nearestCapPair[[i, j]]) {
          const cap1BoundarySubs = capNearestBoundarySubs[thisCapPair[0]]
          const cap2BoundarySubs = capNearestBoundarySubs[thisCapPair[1]]
          for (const cap1BoundarySub of cap1BoundarySubs) {
            const cap1BoundarySubPos = getSubPos(cap1BoundarySub)
            for (const cap2BoundarySub of cap2BoundarySubs) {
              const cap2BoundarySubPos = getSubPos(cap2BoundarySub)
              const dist = this._boundarySubManhattanDist(cap1BoundarySubPos, cap2BoundarySubPos)
              graphIJ[cap1BoundarySub][cap2BoundarySub] = dist
              graphIJ[cap2BoundarySub][cap1BoundarySub] = dist
            }
          }
        }
        this.waterGraph[[i, j]] = new Graph(graphIJ)
        const routeInfo = this._shortestPathBetweenCapPair(i, j)
        route[[i, j]] = routeInfo.route
        routeDist[[i, j]] = routeInfo.dist
      }
    }
    
    // let date2 = new Date()
    // console.log('duration: ', (date2 - date1) / 1000)

    let vertexes = []
    let edges = []
    for (let i = 0; i < this.landGraph.length; i++) {
      vertexes.push({ id: i })
      for (let j = i + 1; j < this.landGraph.length; j++) {
        edges.push({
          u: i,
          v: j,
          // w: getManhattanDist(route[[i, j]])
          w: routeDist[[i, j]]
        })
      }
    }
    let mstGraph = MST()
    mstGraph.initVertex(vertexes)
    mstGraph.storageEdge(edges)
    this.waterMST = Kruskal(mstGraph)
    for (let i = 0; i < this.waterMST.length; i++) {
      let routePair = [this.waterMST[i].u, this.waterMST[i].v]
      this.waterRoute[routePair] = route[routePair]
      this.waterRouteCoords[routePair] = []
      for (let j = 0; j < this.waterRoute[routePair].length; j++) {
        let routeSub = this.waterRoute[routePair][j]
        let node = this.leafNodes.find(node => node.ID === routeSub)
        let nodeCoordX = gridScales.x(node.center.coordinates.x)
        let nodeCoordY = gridScales.y(node.center.coordinates.y)
        this.waterRouteCoords[routePair].push({ x: nodeCoordX, y: nodeCoordY })
      }
      this.harborRouteCorrespondence.push(String(routePair))
      this.harborRouteCorrespondence.push(String(routePair))
      const routeHarbor = this._routeHarbor(this.waterRoute[routePair])
      this.harbor.push(...routeHarbor)
      const routeHarborPos = this._routeHarborPos(routeHarbor)
      this.harborPos.push(...routeHarborPos)
    }

    // this.harbor = Array.from(new Set(this.harbor))
    // this.harborCityPos = Array.from(new Set(this.harborCityPos.map(d => String(d)))).map(d => d.split(',').map(Number))

    // this.harborPos = Array.from(new Set(this.harborPos))
    for (let i = 0; i < this.harborPos.length; i++) {
      this.harborCoords.push(getCoords(this.harborPos[i], gridScales))
    }

    for (let i = 0; i < Object.keys(this.waterRoute).length; i++) {
      let thisRoute = Object.values(this.waterRoute)[i]
      let thisHarbor = []
      let thisHarborPos = []
      let thisHarborCoords = []
      // for (let j = 0; j < this.harbor.length; j++) {
      //   if (thisRoute.indexOf(this.harbor[j]) !== -1) {
      //     thisHarbor.push(this.harbor[j])
      //     thisHarborPos.push(this.harborPos[j])
      //     thisHarborCoords.push(this.harborCoords[j])
      //   }
      // }

      for (let j = 0; j < thisRoute.length; j++) {
        const indexes = this._allIndexes(this.harbor, thisRoute[j])
        if (indexes.length > 0) {
          const key = String(Object.keys(this.waterRoute)[i])
          for (const idx of indexes) {
            if (this.harborRouteCorrespondence[idx] === key) {
              thisHarbor.push(this.harbor[idx])
              thisHarborPos.push(this.harborPos[idx])
              thisHarborCoords.push(this.harborCoords[idx])
            }
          }
        }
      }

      for (let j = 0; j < thisHarbor.length - 1; j++) {
        const harbor1ClsId = Number(this._findIndex(thisHarbor[j], Data.subHierClusters)[0])
        const harbor2ClsId = Number(this._findIndex(thisHarbor[j + 1], Data.subHierClusters)[0])
        
        if (harbor1ClsId === harbor2ClsId) {
          thisHarbor.splice(j, 1)
          j--
        }
      }

      for (let j = 0; j < thisHarbor.length; j++) {
        const idx = this.harbor.indexOf(thisHarbor[j])
        thisHarborPos.push(this.harborPos[idx])
        thisHarborCoords.push(this.harborCoords[idx])
      }

      let candidateRouteSubsPos = getCandidateRouteSubsPos(thisHarbor)
      let seaGraph
      let seaRoutePos

      // 更改seaRoute走向之前的代码
      // if (this.nearestSeaRoute) {
      //   seaGraph = constructSeaGraph(candidateRouteSubsPos)
      //   seaRoutePos = seaGraph.findShortestPath(thisHarborPos[0].toString(), thisHarborPos[1].toString())
      // } else {
      //   let seaGraphAndPath = constructSeaGraphAndPath(candidateRouteSubsPos, thisHarborPos[0].toString(), thisHarborPos[1].toString())
      //   seaGraph = seaGraphAndPath.seaGraph
      //   seaRoutePos = seaGraphAndPath.seaRoutePos
      // }
      // let seaRouteCoords = getSeaRouteCoords(thisHarbor, seaRoutePos, gridScales)
      // this.seaRoutePos.push(seaRoutePos)

      seaGraph = constructSeaGraphByCoords(candidateRouteSubsPos, gridScales)
      let seaRouteCoords = seaGraph.findShortestPath(String(thisHarborCoords[0]), String(thisHarborCoords[1])).map(d => d.split(',').map(Number))
      // 最开始和最后要加Midposition
      seaRouteCoords.unshift(getHarborAndHarborPosMidCoords(thisHarbor[0], String(thisHarborPos[0]), gridScales))
      seaRouteCoords.push(getHarborAndHarborPosMidCoords(thisHarbor[1], String(thisHarborPos[1]), gridScales))
      seaRouteCoords = simplifyCoords(seaRouteCoords)

      this.seaRouteOD.push(thisHarbor)
      this.seaGraph.push(seaGraph)
      this.seaRouteCoords.push(seaRouteCoords)
    }

    function copy2dObj (obj) {
      let res = {}
      for (let key in obj) {
        res[key] = {}
        for (let kkey in obj[key]) {
          res[key][kkey] = obj[key][kkey]
        }
      }
      return res
    }

    function extendObj (obj1, obj2) {
      let res = {}
      for (let key in obj1) {
        res[key] = obj1[key]
      }
      for (let key in obj2) {
        res[key] = obj2[key]
      }
      return res
    }

    function replaceArrElems (replacedArr, start1, end1, replacingArr, start2) {
      let res = JSON.parse(JSON.stringify(replacedArr))
      for (let i = start1; i < end1; i++) {
        res[i] = replacingArr[start2 + i]
      }
      return res
    }

    function getShortestCapPair (country1, country2) {
      let caps1 = self.caps[country1]
      let caps2 = self.caps[country2]
      let capPair = [caps1[0], caps2[0]]
      let minDist = 99999
      let currDist = 99999
      for (let i = 0; i < caps1.length; i++) {
        let cap1 = caps1[i]
        let cap1Pos = getSubPos(cap1)
        for (let j = 0; j < caps2.length; j++) {
          let cap2 = caps2[j]
          let cap2Pos = getSubPos(cap2)
          currDist = manhattanDist(cap1Pos, cap2Pos)
          if (currDist < minDist) {
            minDist = currDist
            capPair = [cap1, cap2]
          }
        }
      }
      return capPair
    }

    function getBoundarySubs (subGraph) {
      let res = []
      for (let key in subGraph) {
        if (Object.keys(subGraph[key]).length !== 6) {
          res.push(key)
        }
      }
      return res
    }

    function getManhattanDist (routeSubs) {
      let dist = 0
      for (let i = 0; i < routeSubs.length - 1; i++) {
        let subPos1 = getSubPos(routeSubs[i])
        let subPos2 = getSubPos(routeSubs[i + 1])
        dist += manhattanDist(subPos1, subPos2)
      }
      return dist
    }

    function getSubPos (subId) {
      let node = self.leafNodes.find(node => node.ID === subId)
      return [node.position.i, node.position.j]
    }

    function manhattanDist (arr1, arr2) {
      let dist = 0
      for (let i = 0; i < arr1.length; i++) {
        dist += Math.abs(arr1[i] - arr2[i])
      }
      return dist
    }

    function euclideanDist (arr1, arr2) {
      let dist = 0
      for (let i = 0; i < arr1.length; i++) {
        dist += Math.pow(arr1[i] - arr2[i], 2)
      }
      return dist
    }

    function getHarborPos (harbor) {
      let node = self.leafNodes.find(node => node.ID === harbor)
      let neighborPositions = Array.from(node.neighbors.values())
      for (let i = 0; i < neighborPositions.length; i++) {
        let neighborNode = self.leafNodes.find(node => JSON.stringify(Object.values(node.position)) === JSON.stringify(neighborPositions[i]))
        if (neighborNode === undefined) {
          return neighborPositions[i]
        }
      }
    }

    function getCoords (position, gridScales) {
      let radius = 1
      let posOThis = [parseInt(position[0]), parseInt(position[1])]
      // let x = (posOThis[1] % 2 === 0) ? (2 * radius * posOThis[0]) : ((2 - 1 / Math.abs(posOThis[0])) * radius * posOThis[0])
      let x
      if (posOThis[1] % 2 === 0) {
        x = 2 * radius * posOThis[0]
      } else {
        if (posOThis[0] === 0) {
          x = 0
        } else {
          x = (2 - 1 / Math.abs(posOThis[0])) * radius * posOThis[0]
        }
      }
      let y = Math.sqrt(3) * radius * posOThis[1]
      return bScale(gridScales, [x, y])
    }

    function getCandidateRouteSubsPos (harbor) {
      let range0 = getClusterPosRangeFromSub(harbor[0])
      let range1 = getClusterPosRangeFromSub(harbor[1])
      let xmin = Math.min(range0.x[0], range1.x[0]) - 3
      let xmax = Math.max(range0.x[1], range1.x[1]) + 3
      let ymin = Math.min(range0.y[0], range1.y[0]) - 3
      let ymax = Math.max(range0.y[1], range1.y[1]) + 3
      let res = []
      for (let x = xmin; x < xmax + 1; x++) {
        for (let y = ymin; y < ymax + 1; y++) {
          if (self.leafNodes.find(node => node.position.i === x && node.position.j === y) === undefined) {
            res.push(`${x},${y}`)
            // res.push([x, y])
          }
        }
      }
      return res
    }

    function constructSeaGraphByCoords (subsPos, gridScales) {
      let graph = {}
      // 0是中心，1-6是顶点，从右上顺时针到最上
      let linkableVertexIdPairs = [
        [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6],
        [1, 2], [1, 6],
        [2, 3], [3, 4], [4, 5], [5, 6]
      ].map(String)

      for (let i = 0; i < subsPos.length; i++) {
        let subPos = subsPos[i]
        let neighborsPos = getNeighborsInPosition(subPos.split(',').map(Number))
        let interCoords = getSubCenterAndVertexCoords(subPos.split(',').map(Number), gridScales)
        let availableInterCoords = getAvaliableInterCoords(neighborsPos, subsPos, interCoords)
        addIntraLinkToCoordGraph(graph, linkableVertexIdPairs, availableInterCoords)
        // Add inter link to coord graph
        for (let j = 0; j < neighborsPos.length; j++) {
          let neighborPos = neighborsPos[j]
          if (subsPos.indexOf(neighborPos) > -1) {
            let subPosCoords = getCoords(subPos.split(',').map(Number), gridScales)
            let neighborPosCoords = getCoords(neighborPos.split(',').map(Number), gridScales)
            addToCoordGraph(graph, subPosCoords, neighborPosCoords)
          }
        }
      }

      return new Graph(graph)
    }

    function constructSeaGraphAndPath (subsPos, pos0, pos1) {
      // 策略：去到下一个子空间的时候，要保证下个子空间的6个邻居有
      // 不大于minGraphNeighborNum个是城市。
      let graph = {}
      let seaGraph
      let seaRoutePos = null
      let minGraphNeighborNum = 0

      while (seaRoutePos === null) {
        for (let i = 0; i < subsPos.length; i++) {
          let subPos = subsPos[i]
          graph[subPos] = {}
          let neighborsPos = getNeighborsInPosition(subPos.split(',').map(Number))
          let candidateNeighbors = []
          for (let j = 0; j < neighborsPos.length; j++) {
            let neighborPos = neighborsPos[j]
            let inSubPos = subsPos.indexOf(neighborPos) !== -1
            let neighborsPosOfNeighbor = getNeighborsInPosition(neighborPos.split(',').map(Number))
            let neighborOfNeighborIsNode = false
            for (let k = 0; k < neighborsPosOfNeighbor.length; k++) {
              let neighborPosOfNeighbor = neighborsPosOfNeighbor[k].split(',').map(Number)
              let neighborNodeOfNeighbor = self.leafNodes.find(node => node.position.i === neighborPosOfNeighbor[0] && node.position.j === neighborPosOfNeighbor[1])
              if (neighborNodeOfNeighbor !== undefined) {
                neighborOfNeighborIsNode = true
                break
              }
            }
            if (inSubPos) {
              if (!neighborOfNeighborIsNode) {
                graph[subPos][neighborPos] = 1
              } else {
                candidateNeighbors.push(neighborPos)
              }
            }
          }
          if (Object.keys(graph[subPos]).length <= minGraphNeighborNum) {
            for (let j = 0; j < candidateNeighbors.length; j++) {
              graph[subPos][candidateNeighbors[j]] = 1
            }
          }
        }
  
        seaGraph = new Graph(graph)
        seaRoutePos = seaGraph.findShortestPath(pos0, pos1)
        minGraphNeighborNum++
      }

      return { seaGraph: seaGraph, seaRoutePos: seaRoutePos }
    }

    function constructSeaGraph (subsPos) {
      let graph = {}
      for (let i = 0; i < subsPos.length; i++) {
        let subPos = subsPos[i]
        graph[subPos] = {}
        let neighborsPos = getNeighborsInPosition(subPos.split(',').map(Number))
        for (let j = 0; j < neighborsPos.length; j++) {
          let neighborPos = neighborsPos[j]
          let inSubPos = subsPos.indexOf(neighborPos) !== -1
          if (inSubPos) {
            graph[subPos][neighborPos] = 1
          }
        }
      }
      return new Graph(graph)
    }

    function getNeighborsInPosition (pos) {
      let intPos = { i: pos[0], j: pos[1] }
      let neighbors = []
      let x0, x1, x2, x3
      if (intPos.j % 2 === 0) {
        x0 = 1
        x1 = (intPos.i >= 0) ? 1 : 0
        x2 = (intPos.i <= 0) ? -1 : 0
        x3 = -1
      } else {
        x0 = (intPos.i === -1) ? 2 : 1
        x1 = (intPos.i < 0) ? 1 : 0
        x2 = (intPos.i > 0) ? -1 : 0
        x3 = (intPos.i === 1) ? -2 : -1
      }
      // 方向：右、右下、左下、左、左上、右上
      neighbors.push([intPos.i + x0, intPos.j])
      neighbors.push([intPos.i + x1, intPos.j + 1])
      neighbors.push([intPos.i + x2, intPos.j + 1])
      neighbors.push([intPos.i + x3, intPos.j])
      neighbors.push([intPos.i + x2, intPos.j - 1])
      neighbors.push([intPos.i + x1, intPos.j - 1])
      return neighbors.map(String)
    }

    function getSubCenterAndVertexCoords (pos, gridScales) {
      let coords = []
      let centerCoords = getCoords(pos, gridScales)
      let rightCenterCoords = getCoords([pos[0] + 1, pos[1]], gridScales)
      let halfDiagonalLen = (rightCenterCoords[0] - centerCoords[0]) / 2 / Math.cos(Math.PI / 6)
      coords[0] = centerCoords
      for (let i = 0; i < 6; i++) {
        let coord = [
          // 第一个顶点位于右上，因为第一二个顶点与第一个邻居（位于右侧）相连
          centerCoords[0] + halfDiagonalLen * Math.cos(-Math.PI / 6 + Math.PI / 3 * i),
          centerCoords[1] + halfDiagonalLen * Math.sin(-Math.PI / 6 + Math.PI / 3 * i)
        ]
        coords.push(coord)
      }
      return coords
    }

    function getAvaliableInterCoords (neighborsPos, subsPos, interCoords) {
      let availableInterCoords = new Map()
      // 中心一定可用
      for (let i = 0; i < interCoords.length; i++) {
        availableInterCoords.set(i, interCoords[i])
      }
      for (let i = 0; i < neighborsPos.length; i++) {
        if (subsPos.indexOf(neighborsPos[i]) === -1) {
          if (i === 5) {
            availableInterCoords.delete(1)
            availableInterCoords.delete((i + 1))
          } else {
            availableInterCoords.delete((i + 1))
            availableInterCoords.delete((i + 2))
          }
        }
      }
      return availableInterCoords
    }

    function addIntraLinkToCoordGraph (graph, linkableVertexIdPairs, availableInterCoords) {
      let vertexIndices = Array.from(availableInterCoords.keys())
      for (let i = 0; i < vertexIndices.length; i++) {
        for (let j = 0; j < vertexIndices.length; j++) {
          let idPair = String([vertexIndices[i], vertexIndices[j]])
          if (linkableVertexIdPairs.indexOf(idPair) > -1) {
            let coordI = availableInterCoords.get(vertexIndices[i])
            let coordJ = availableInterCoords.get(vertexIndices[j])
            addToCoordGraph(graph, coordI, coordJ)
            addToCoordGraph(graph, coordJ, coordI)
          }
        }
      }
    }

    function addToCoordGraph (graph, coord1, coord2) {
      let strCoord1 = String(coord1)
      let strCoord2 = String(coord2)
      if (!graph.hasOwnProperty(strCoord1)) {
        graph[strCoord1] = {}
      }
      if (!graph[strCoord1].hasOwnProperty(strCoord2)) {
        let dist = getCoordDist(coord1, coord2)
        graph[strCoord1][strCoord2] = dist
      }
    }

    function getCoordDist (coord1, coord2) {
      return Math.sqrt(Math.pow((coord1[0] - coord2[0]), 2) + Math.pow((coord1[1] - coord2[1]), 2))
    }

    function getSeaRouteCoords (harbor, routePos, gridScales) {
      let coords = []
      coords.push(getHarborAndHarborPosMidCoords(harbor[0], routePos[0], gridScales))
      for (let i = 0; i < routePos.length; i++) {
        coords.push(getCoords(routePos[i].split(',').map(Number), gridScales))
      }
      coords.push(getHarborAndHarborPosMidCoords(harbor[1], routePos[routePos.length - 1], gridScales))
      return coords
    }

    function getHarborAndHarborPosMidCoords(harbor, routePos, gridScales) {
      let harborNode = self.leafNodes.find(node => node.ID === harbor)
      let harborRealPos = [harborNode.position.i, harborNode.position.j]
      let harborRealCoords = getCoords(harborRealPos, gridScales)
      let harborMapPos = routePos.split(',').map(Number)
      let harborMapCoords = getCoords(harborMapPos, gridScales)
      return [
        harborRealCoords[0] + (harborMapCoords[0] - harborRealCoords[0]) / 2,
        harborRealCoords[1] + (harborMapCoords[1] - harborRealCoords[1]) / 2
      ]
    }

    function getClusterPosRangeFromSub (sub) {
      let clsID = Number(self._findIndex(sub, Data.subHierClusters)[0])
      let clsMembers = Data.subHierClusters[clsID].flat()
      let xPos = []
      let yPos = []
      for (let i = 0; i < clsMembers.length; i++) {
        let node = self.leafNodes.find(node => node.ID === clsMembers[i])
        xPos.push(node.position.i)
        yPos.push(node.position.j)
      }
      return {
        x: d3.extent(xPos),
        y: d3.extent(yPos)
      }
    }

    function simplifyCoords (coords) {
      let simplifiedCoords = []
      for (let i = 0; i < coords.length - 1; i++) {
        let coord0 = coords[i]
        let coord0Next = coords[i + 1]
        simplifiedCoords.push([
          [coord0[0], coord0[1]],
          [coord0Next[0], coord0Next[1]]
        ])
        let simplifiedCoordsLen = simplifiedCoords.length
        for (let j = i + 1; j < coords.length - 1; j++) {
          i = j - 1
          let line1 = JSON.parse(JSON.stringify(simplifiedCoords[simplifiedCoordsLen - 1]))
          let coord2 = coords[j]
          let coord3 = coords[j + 1]
          let line2 = [coord2, coord3]
          // if (equalSlope(line1, line2)) {
          //   simplifiedCoords[simplifiedCoordsLen - 1][1] = [coord3[0], coord3[1]]
          // } else {
          //   let mergedLine = [[coord0[0], coord0[1]], [coord3[0], coord3[1]]]
          //   if (!self.shapeIntersect(mergedLine)) {
          //     simplifiedCoords[simplifiedCoordsLen - 1][1] = [coord3[0], coord3[1]]
          //   } else {
          //     break
          //   }
          // }
          let mergedLine = [[coord0[0], coord0[1]], [coord3[0], coord3[1]]]
          if (!self.shapeIntersect(mergedLine)) {
            simplifiedCoords[simplifiedCoordsLen - 1][1] = [coord3[0], coord3[1]]
          } else {
            break
          }
          if (j === coords.length - 2) {
            return mergeCoords(simplifiedCoords)
          }
        }
      }
      return mergeCoords(simplifiedCoords)
    }

    function equalSlope (line1, line2) {
      let tolerance = 0.01
      if (line1[0][0] === line1[1][0] && line1[1][0] === line2[1][0]) {
        return true
      } else {
        return Math.abs(slope(line1) - slope(line2)) < tolerance
      }
    }

    function slope (line) {
      return (line[1][1] - line[0][1]) / (line[1][0] - line[0][0])
    }

    function mergeCoords (coordsOfLines) {
      let lineCoords = []
      lineCoords.push(...coordsOfLines[0])
      for (let i = 1; i < coordsOfLines.length; i++) {
        lineCoords.push(coordsOfLines[i][1])
      }
      return lineCoords
    }
  }

  _routeHarbor (route) {
    for (let i = 0; i < route.length - 1; i++) {
      const clsID1 = Number(this._findIndex(route[i], Data.subHierClusters)[0])
      const clsID2 = Number(this._findIndex(route[i + 1], Data.subHierClusters)[0])
      if (clsID1 !== clsID2) {
        return [route[i], route[i + 1]]
      }
    }
  }

  _allIndexes (arr, val) {
    let indexes = []
    let i

    for(i = 0; i < arr.length; i++) {
      if (arr[i] === val) {
        indexes.push(i)
      }
    }

    return indexes
}

  // 基于角度寻找harborPos
  // _routeHarborPos (routeHarbor) {
  //   const harbor1 = routeHarbor[0]
  //   const harbor2 = routeHarbor[1]

  //   const harbor1Node = this.leafNodes.find(node => node.ID === harbor1)
  //   const harbor2Node = this.leafNodes.find(node => node.ID === harbor2)

  //   const harbor1EmptyNeighborPositions = this._getSubEmptyNeighborPositions(harbor1Node)
  //   const harbor2EmptyNeighborPositions = this._getSubEmptyNeighborPositions(harbor2Node)

  //   const angle = this._angle(
  //     harbor1Node.center.coordinates.x, harbor1Node.center.coordinates.y,
  //     harbor2Node.center.coordinates.x, harbor2Node.center.coordinates.y
  //   )

  //   let minAngleDiff = 99999
  //   let currAngleDiff = 99999
  //   let harborPos
  //   for (const position1 of harbor1EmptyNeighborPositions) {
  //     const coords1 = getCoords(position1, this.gridScales)
  //     for (const position2 of harbor2EmptyNeighborPositions) {
  //       const coords2 = getCoords(position2, this.gridScales)
  //       const neighborAngle = this._angle(coords1[0], coords1[1], coords2[0], coords2[1])
  //       currAngleDiff = Math.abs(neighborAngle - angle)
  //       if (currAngleDiff < minAngleDiff) {
  //         harborPos = [position1, position2]
  //         minAngleDiff = currAngleDiff
  //       }
  //     }
  //   }

  //   return harborPos

  //   function getCoords (position, gridScales) {
  //     let radius = 1
  //     let posOThis = [parseInt(position[0]), parseInt(position[1])]
  //     // let x = (posOThis[1] % 2 === 0) ? (2 * radius * posOThis[0]) : ((2 - 1 / Math.abs(posOThis[0])) * radius * posOThis[0])
  //     let x
  //     if (posOThis[1] % 2 === 0) {
  //       x = 2 * radius * posOThis[0]
  //     } else {
  //       if (posOThis[0] === 0) {
  //         x = 0
  //       } else {
  //         x = (2 - 1 / Math.abs(posOThis[0])) * radius * posOThis[0]
  //       }
  //     }
  //     let y = Math.sqrt(3) * radius * posOThis[1]
  //     return bScale(gridScales, [x, y])
  //   }
  // }

  _nearestCapPair () {
    let pair = {}

    const caps = this.caps
    for (let i = 0; i < caps.length; i++) {
      for (let j = i + 1; j < caps.length; j++) {
        let thisPair = {}
        for (let p = 0; p < caps[i].length; p++) {
          const cap1 = caps[i][p]
          for (let q = 0; q < caps[j].length; q++) {
            const cap2 = caps[j][q]
            thisPair[[cap1, cap2]] = this._subCoordsEuclideanDist(cap1, cap2)
          }
        }
        const thisSortedCapPair = Object.keys(thisPair).sort(function (a, b) { return thisPair[a] - thisPair[b] })
        pair[[i, j]] = thisSortedCapPair.slice(0, this.kc).map(item => item.split(',').map(Number))
      }
    }

    return pair
  }

  _subCoordsEuclideanDist (sub1, sub2) {
    const coords1 = this._getCoordsFromSub(sub1)
    const coords2 = this._getCoordsFromSub(sub2)

    return Math.sqrt(Math.pow(coords1[0] - coords2[0], 2) + Math.pow(coords1[1] - coords2[1], 2))
  }

  _getCoordsFromSub (sub) {
    const node = this.leafNodes.find(node => node.ID === sub)
    return [
      this.gridScales.x(node.center.coordinates.x),
      this.gridScales.y(node.center.coordinates.y)
    ]
  }

  _capsInNearestCapPair (pair) {
    let caps = []

    for (const pairArr of Object.values(pair)) {
      for (const capPair of pairArr) {
        caps.push(...capPair)
      }
    }

    return Array.from(new Set(caps))
  }

  _capNearestBoundarySubs (caps) {
    let capNearestBoundarySubs = {}

    for (const cap of caps) {
      const clsId = Number(this._findIndex(cap, Data.subHierClusters)[0])
      const thisClsBoundarySubs = this.clusterBoundarySubs[clsId]
      let thisPair = {}
      for (const sub of thisClsBoundarySubs) {
        thisPair[sub] = this._subCoordsEuclideanDist(cap, sub)
      }
      const thisSortedPair = Object.keys(thisPair).sort(function (a, b) { return thisPair[a] - thisPair[b] })
      capNearestBoundarySubs[cap] = thisSortedPair.slice(0, this.ks).map(Number)
    }

    return capNearestBoundarySubs
  }

  _boundarySubs () {
    let boundarySubs = []

    for (const subCls of this.cls) {
      let clsBoundarySubs = []
      for (let sub of subCls) {
        let node = this.leafNodes.find(node => node.ID === sub)
        let neighborPositions = Array.from(node.neighbors.values())
        for (let neighborPosition of neighborPositions) {
          let neighborNode = this.leafNodes.find(node => JSON.stringify(Object.values(node.position)) === JSON.stringify(neighborPosition))
          if (neighborNode === undefined) {
            clsBoundarySubs.push(sub)
            continue
          }
        }
      }
      clsBoundarySubs = clsBoundarySubs.map(JSON.stringify).reverse().filter(function (e, i, a) {
        return a.indexOf(e, i + 1) === -1
      }).reverse().map(JSON.parse)
      boundarySubs.push(clsBoundarySubs)
    }

    return boundarySubs
  }

  _boundarySubPositions () {
    let subPositions = []

    for (const thisClsBoundarySubs of this.clusterBoundarySubs) {
      let thisClsSubPositions = []
      for (const sub of thisClsBoundarySubs) {
        thisClsSubPositions.push(this._subPos(sub))
      }
      subPositions.push(thisClsSubPositions)
    }

    return subPositions
  }

  _subPos (subId) {
    const node = this.leafNodes.find(node => node.ID === subId)
    return [node.position.i, node.position.j]
  }

  // 基于最短路径寻找harborPos
  _routeHarborPos (routeHarbor) {
    const harbor1 = routeHarbor[0]
    const harbor2 = routeHarbor[1]

    const harbor1Pos = Object.values(this.leafNodes.find(node => node.ID === harbor1).position)
    const harbor2Pos = Object.values(this.leafNodes.find(node => node.ID === harbor2).position)

    let graph = this._copy2dObj(this.boundaryGraph.map)
    
    for (let key in graph[String(harbor2Pos)]) {
      graph[key][String(harbor2Pos)] = graph[String(harbor2Pos)][key]
    }

    graph = new Graph(graph)
    const route = graph.findShortestPath(String(harbor1Pos), String(harbor2Pos))
    const harborPos = [route[1].split(',').map(Number), route[route.length - 2].split(',').map(Number)]

    return harborPos
  }

  _angle (x1, y1, x2, y2) {
    let angle = Math.atan2(y2 - y1, x2 - x1)
    angle *= 180 / Math.PI
    if (angle < 0) {
      angle += 360
    }
    return angle
  }

  _getSubEmptyNeighborPositions (node) {
    const neighborPositions = Array.from(node.neighbors.values())
    let emptyNeighborPositions = []

    for (let neighborPosition of neighborPositions) {
      if (this._arrayAlreadyHasArray(this.emptyPositions, neighborPosition)) {
        emptyNeighborPositions.push(neighborPosition)
      }
    }

    return emptyNeighborPositions
  }

  _findIndex (valueToSearch, theArray, currentIndex) {
    if (currentIndex == undefined) currentIndex = ''
    if (Array.isArray(theArray)) {
      for (var i = 0; i < theArray.length; i++) {
        if (Array.isArray(theArray[i])) {
          let newIndex = this._findIndex(valueToSearch, theArray[i], currentIndex + i + ',')
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

  _arrayAlreadyHasArray (arr, subarr) {
    for (let i = 0; i < arr.length; i++) {
      let checker = false
      for (let j = 0; j < arr[i].length; j++) {
        if (arr[i][j] === subarr[j]) {
          checker = true
        } else {
          checker = false
          break
        }
      }
      if (checker) {
        return true
      }
    }
    return false
  }

  _neighborManhattanDist (arr1, arr2) {
    // arr1和arr2都指代position arr，均为2d arr
    // 奇数行和偶数行坐标设定有些区别
    // 更具体的，这个函数只算邻居间的距离，因此，同一行距离为1，不同行距离为2

    if (arr1[1] === arr2[1]) {
      return 1
    } else {
      return 2
    }
    // return 2
  }

  // 初始的boundary graph只能建立从boundary1到boundary2的neighbor
  // 因此这里需要动态更新boundary graph
  // 计算过程中建立boundary2的neighbor到boundary2的link
  _boundarySubManhattanDist (arr1, arr2) {
    let graph = this._copy2dObj(this.boundaryGraph.map)
    
    for (let key in graph[String(arr2)]) {
      graph[key][String(arr2)] = graph[String(arr2)][key]
    }

    graph = new Graph(graph)
    const route = graph.findShortestPath(String(arr1), String(arr2))

    let dist = Infinity
    if (route !== null) {
      dist = this._routeManhattanDist(graph, route)
    }

    return dist
  }

  _routeManhattanDist (graph, route) {
    let dist = 0

    for (let i = 0; i < route.length - 1; i++) {
      dist += graph.map[route[i]][route[i + 1]]
    }

    return dist
  }

  _copy2dObj (obj) {
    let res = {}
    for (let key in obj) {
      res[key] = {}
      for (let kkey in obj[key]) {
        res[key][kkey] = obj[key][kkey]
      }
    }
    return res
  }

  _shortestPathBetweenCapPair (country1, country2) {
    const graph = this.waterGraph[[country1, country2]]
    const self = this

    const caps1 = self.caps[country1]
    const caps2 = self.caps[country2]
    let minRoute
    let minDist = 99999
    let currDist = 99999

    for (let i = 0; i < caps1.length; i++) {
      const cap1 = caps1[i]
      for (let j = 0; j < caps2.length; j++) {
        const cap2 = caps2[j]
        const route = graph.findShortestPath(cap1, cap2)
        currDist = this._routeManhattanDist(graph, route)
        if (currDist < minDist) {
          minDist = currDist
          minRoute = JSON.parse(JSON.stringify(route)).map(Number)
        }
      }
    }

    return { route: minRoute, dist: minDist }
  }

  addLandRoute (gridScales) {
    const self = this
    for (let i = 0; i < this.landRoute.length; i++) {
      for (let j = 0; j < this.harbor.length; j++) {
        if (Number(this._findIndex(this.harbor[j], Data.subHierClusters)[0]) === i) {
          // let thisRoute = this.landGraph[i].findShortestPath(Data.nationalCaps[i], this.harbor[j]).map(Number)
          let nearestCap = getNearestCap(i, this.harbor[j])
          // let thisRoute = this.landGraph[i].findShortestPath(nearestCap, this.harbor[j]).map(Number)
          let thisRoute
          if (nearestCap === this.harbor[j]) {
            thisRoute = [nearestCap, nearestCap]
          } else {
            thisRoute = this.landGraph[i].findShortestPath(nearestCap, this.harbor[j]).map(Number)
          }
          let thisCoords = []
          // this.landRoute[i][[Data.nationalCaps[i], this.harbor[j]]] = thisRoute
          this.landRoute[i][[nearestCap, this.harbor[j]]] = thisRoute
          for (let k = 0; k < thisRoute.length; k++) {
            let node = this.leafNodes.find(node => node.ID === thisRoute[k])
            let nodeCoordX = gridScales.x(node.center.coordinates.x)
            let nodeCoordY = gridScales.y(node.center.coordinates.y)
            thisCoords.push({
              x: nodeCoordX,
              y: nodeCoordY
            })
            if (k === thisRoute.length - 1) {
              thisCoords.push({
                x: nodeCoordX + (this.harborCoords[j][0] - nodeCoordX) / 2,
                y: nodeCoordY + (this.harborCoords[j][1] - nodeCoordY) / 2
              })
            }
          }
          this.landRouteCoords[i].push(thisCoords)
        }
      }
    }

    function getNearestCap (country, city) {
      let caps = self.caps[country]
      let cityPos = getSubPos(city)
      let minDist = 99999
      let currDist = 99999
      let nearestCap
      for (let i = 0; i < caps.length; i++) {
        let cap = caps[i]
        let capPos = getSubPos(cap)
        currDist = manhattanDist(capPos, cityPos)
        if (currDist < minDist) {
          minDist = currDist
          nearestCap = cap
        }
      }
      return nearestCap
    }

    function getSubPos (subId) {
      let node = self.leafNodes.find(node => node.ID === subId)
      return [node.position.i, node.position.j]
    }

    function manhattanDist (arr1, arr2) {
      let dist = 0
      for (let i = 0; i < arr1.length; i++) {
        dist += Math.abs(arr1[i] - arr2[i])
      }
      return dist
    }
  }

  // 拆分各个国家的land route，形成最小单元
  // 避免部分路段的重复绘制
  splitLandRoute () {
    const self = this
    this.landSplittedRoute = []
    this.landSplittedRouteCoords = []
    for (let i = 0; i < this.landRoute.length; i++) {
      this.landSplittedRoute[i] = []
      this.landSplittedRouteCoords[i] = []
      let routes = Object.values(this.landRoute[i])
      for (let j = 0; j < routes.length; j++) {
        let route = routes[j]
        let coords = this.landRouteCoords[i][j]
        this.landSplittedRoute[i] = this.landSplittedRoute[i].concat(splitRoute(route))
        this.landSplittedRouteCoords[i] = this.landSplittedRouteCoords[i].concat(splitRouteCoords(route, coords))
      }
      removeDuplicateElems(this.landSplittedRoute[i], this.landSplittedRouteCoords[i])
    }

    function splitRoute (route) {
      let splittedRoute = []
      for (let i = 0; i < route.length - 1; i++) {
        splittedRoute.push([route[i], route[i + 1]])
      }
      return splittedRoute
    }

    function splitRouteCoords (route, coords) {
      let splittedRouteCoords = []
      for (let i = 0; i < route.length - 1; i++) {
        if ((self.harbor.indexOf(route[i + 1]) > -1) && (coords[i + 2] !== undefined)) {
          splittedRouteCoords.push([coords[i], coords[i + 1], coords[i + 2]])
        } else {
          splittedRouteCoords.push([coords[i], coords[i + 1]])
        }
      }
      return splittedRouteCoords
    }

    function removeDuplicateElems (splittedRoute, splittedCoords) {
      let removedIndices = []
      for(let i = 0; i < splittedRoute.length; i++) {
        for(let j = i + 1; j < splittedRoute.length; ) {
          if(splittedRoute[i][0] == splittedRoute[j][0] && splittedRoute[i][1] == splittedRoute[j][1]) {
            // Found the same. Remove it.
            splittedRoute.splice(j, 1)
            removedIndices.push(j)
          }
          else {
            // No match. Go ahead.
            j++
          }
        }    
      }
      for (let i = 0; i < removedIndices.length; i++) {
        splittedCoords.splice(removedIndices[i], 1)
      }
    }
  }

  shapeIntersect(line) {
    let lineShape = ShapeInfo.line(line.flat())
    for (let i = 0; i < this.shapes.length; i++) {
      let intersections = Intersection.intersect(this.shapes[i], lineShape)
      if (intersections.points.length > 0) {
        return true
      }
    }
    return false
  }

  // 把每条小线段尽可能地组合成长的线段
  // 避免小线段连接处的缝隙
  combineLandRoute () {
    this.landCombinedRoute = []
    this.landCombinedRouteCoords = []
    for (let i = 0; i < this.landSplittedRoute.length; i++) {
      this.landCombinedRoute[i] = []
      this.landCombinedRouteCoords[i] = []
      let routes = this.landSplittedRoute[i]
      let coordsOfRoutes = this.landSplittedRouteCoords[i]
      let combinedRoute = JSON.parse(JSON.stringify(routes[0]))
      let combinedRouteCoords = JSON.parse(JSON.stringify(coordsOfRoutes[0]))
      for (let j = 0; j < routes.length - 1; j++) {
        let nextCoords = coordsOfRoutes[j + 1]
        if (routes[j][1] === routes[j + 1][0]) {
          combinedRoute.push(routes[j + 1][1])
          for (let k = 1; k < nextCoords.length; k++) {
            combinedRouteCoords.push(nextCoords[k])
          }
        } else if (routes[j][0] === routes[j + 1][1]) {
          combinedRoute.unshift(routes[j + 1][0])
          for (let k = nextCoords.length - 2; k > -1; k--) {
            combinedRouteCoords.unshift(nextCoords[k])
          }
        }else {
          this.landCombinedRoute[i].push(combinedRoute)
          this.landCombinedRouteCoords[i].push(combinedRouteCoords)
          combinedRoute = JSON.parse(JSON.stringify(routes[j + 1]))
          combinedRouteCoords = JSON.parse(JSON.stringify(nextCoords))
        }
      }
      this.landCombinedRoute[i].push(combinedRoute)
      this.landCombinedRouteCoords[i].push(combinedRouteCoords)

      if (this.landCombinedRoute[i].length > 1) {
        for (let j = 0; j < this.landCombinedRoute[i].length; j++) {
          for (let k = j + 1; k < this.landCombinedRoute[i].length; ) {
            let routeJLen = this.landCombinedRoute[i][j].length
            let routeKLen = this.landCombinedRoute[i][k].length
            if (this.landCombinedRoute[i][j][0] === this.landCombinedRoute[i][k][0]) {
              // 翻转k，放j的front
              manipulateArr(this.landCombinedRoute[i], j, k, true, 'front')
              manipulateArr(this.landCombinedRouteCoords[i], j, k, true, 'front')
            } else if (this.landCombinedRoute[i][j][0] === this.landCombinedRoute[i][k][routeKLen - 1]) {
              // k放j的front
              manipulateArr(this.landCombinedRoute[i], j, k, false, 'front')
              manipulateArr(this.landCombinedRouteCoords[i], j, k, false, 'front')
            } else if (this.landCombinedRoute[i][j][routeJLen - 1] === this.landCombinedRoute[i][k][0]) {
              // k放j的end
              manipulateArr(this.landCombinedRoute[i], j, k, false, 'end')
              manipulateArr(this.landCombinedRouteCoords[i], j, k, false, 'end')
            } else if (this.landCombinedRoute[i][j][routeJLen - 1] === this.landCombinedRoute[i][k][routeKLen - 1]) {
              // 翻转k，放j的end
              manipulateArr(this.landCombinedRoute[i], j, k, true, 'end')
              manipulateArr(this.landCombinedRouteCoords[i], j, k, true, 'end')
            } else {
              k++
            }
          }
        }
      }
    }

    function manipulateArr (arr, concatIdx, spliceIdx, reverse, loc) {
      let spliceArr = arr.splice(spliceIdx, 1)[0]
      if (reverse) {
        spliceArr.reverse()
      }
      if (loc === 'front') {
        arr[concatIdx].splice(0, 1)
        arr[concatIdx] = spliceArr.concat(arr[concatIdx])
      } else if (loc === 'end') {
        arr[concatIdx].splice(arr[concatIdx].length - 1, 1)
        arr[concatIdx] = arr[concatIdx].concat(spliceArr)
      }
    }
  }

  getLandSubCoords () {
    this.landSubCoords = new Map()
    for (let i = 0; i < this.landSplittedRoute.length; i++) {
      let routes = this.landSplittedRoute[i]
      let coordsOfRoutes = this.landSplittedRouteCoords[i]
      for (let j = 0; j < routes.length; j++) {
        let route = routes[j]
        let coords = coordsOfRoutes[j]
        this.landSubCoords.set(route[0], coords[0])
        if (this.harbor.indexOf(route[1]) > -1) {
          this.landSubCoords.set(route[1], [coords[1], coords[2]])
        } else {
          this.landSubCoords.set(route[1], coords[1])
        }
      }
    }
  }

  draw (v_g) {
    this.drawLandRoute(v_g)
    // this.drawHarbor(v_g)
    this.drawSeaRoute(v_g)
  }

  drawLandRoute (v_g) {
    const self = this
    const line = d3.line()
      .x(d => d.x)
      .y(d => d.y)
    v_g.selectAll('.mapLandRoute')
      // .data(this.landRoute)
      // .data(this.landSplittedRoute)
      .data(this.landCombinedRoute)
      .enter()
      .append('g')
      .attr('class', 'mapLandRoute')
      .attr('id', (d, i) => `mapLandRoute${i}`)
      .each(drawRoute)
    
    function drawRoute (p, idx) {
      let g = d3.select(this)
      g.selectAll('.landRoute')
        // .data(self.landRouteCoords[idx])
        // .data(self.landSplittedRouteCoords[idx])
        .data(self.landCombinedRouteCoords[idx])
        .enter()
        .append('path')
        .attr('class', 'landRoute')
        // .attr('od', (d, i) => Object.keys(p)[i])
        // .attr('od', (d, i) => p[i])
        .attr('id', (d, i) => `landRoute${idx}_${i}`)
        .attr('d', line)
    }
  }

  drawHarbor (v_g) {
    const self = this
    v_g
      .append('g')
      .attr('class', 'mapHarbor')
      .selectAll('.harbor')
      // .data(this.harborPos)
      .data(this.harborCoords)
      .enter()
      .append('g')
      .attr('class', 'harbor')
      // .attr('transform', d => `translate(${getCoords(d, gridScales)})scale(${self.harborIconScale})`)
      .attr('transform', d => `translate(${d})scale(${self.harborIconScale})`)
      .style('opacity', 0)
      .append('path')
      .attr('d', this.harborIcon)
    
    let gSize = v_g.select('.harbor').node().getBoundingClientRect()

    v_g.select('.mapHarbor').selectAll('.harbor')
      .attr('transform', function () {
        return getNewHarborCoords(d3.select(this), gSize)
      })
      .style('opacity', 1)

    function getNewHarborCoords (thisHarbor, gSize) {
      let prevTranslate = self.getTranslate(thisHarbor)
      let mapSvgTransform = getTransformation(d3.select('#mapSvg').attr('transform'))
      let newTranslate = [prevTranslate[0] - gSize.width / 2 / mapSvgTransform.scaleX, prevTranslate[1] - gSize.height / 2 / mapSvgTransform.scaleY]
      return `translate(${newTranslate})scale(${self.harborIconScale})`
    }
  }

  drawSeaRoute (v_g) {
    const self = this

    const line = d3.line()
      .x(d => d[0])
      .y(d => d[1])
      .curve(d3.curveCatmullRom.alpha(1))
    v_g.append('g')
      .attr('class', 'mapSeaRoute')
      .selectAll('.seaRoute')
      .data(this.seaRouteCoords)
      .enter()
      .append('path')
      .attr('class', 'seaRoute')
      // .attr('od', getSeaRouteOD)
      .attr('od', (d, i) => this.seaRouteOD[i])
      .attr('id', (d, i) => `seaRoute${i}`)
      .attr('d', line)
    
    function getSeaRouteOD (p, idx) {
      // let thisRoutePos = self.seaRoutePos[idx]
      // let harborPos0 = thisRoutePos[0]
      // let harborPos1 = thisRoutePos[thisRoutePos.length - 1]
      // return `${getHarborFromPos(harborPos0)},${getHarborFromPos(harborPos1)}`
      let harborCoord0 = p[1]
      let harborCoord1 = p[p.length - 2]
      return `${getHarborFromCoord(harborCoord0)},${getHarborFromCoord(harborCoord1)}`
    }

    function getHarborFromPos (pos) {
      for (let i = 0; i < self.harborPos.length; i++) {
        if (pos === String(self.harborPos[i])) {
          return self.harbor[i]
        }
      }
    }

    function getHarborFromCoord (coord) {
      return self.harbor[self.harborCoords.map(String).indexOf(String(coord))]
    }
  }

  drawHighlightLandRoute (v_g, routeCoords) {
    const line = d3.line()
      .x(d => d.x)
      .y(d => d.y)
    v_g.selectAll('.hightlightLandRoute')
      .data(routeCoords)
      .enter()
      .append('path')
      .attr('class', 'hightlightLandRoute')
      .attr('d', line)
      .style('visibility', 'hidden')
  }

  showHighlightLandRoute (v_g) {
    v_g.selectAll('.hightlightLandRoute')
      .style('visibility', 'visible')
  }

  getTranslate (g) {
    let transform = g.attr('transform')
    let leftBracketPos = transform.indexOf('(')
    let commaPos = transform.indexOf(',')
    let rightBracketPos = transform.indexOf(')')
    return [
      parseFloat(transform.substring(leftBracketPos + 1, commaPos)),
      parseFloat(transform.substring(commaPos + 1, rightBracketPos))
    ]
  }
}

// basic
function bScale (v_scales, v_data) {
  return [v_scales.x(v_data[0]), v_scales.y(v_data[1])]
}

let exportClass = () => {
  return (...params) => {
    return new Route(...params)
  }
}

export default exportClass()