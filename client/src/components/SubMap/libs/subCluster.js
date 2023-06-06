export default class SubCluster {
  constructor (dcdID, subTree, anchor, levelOThis, cellRadius, polygonCreator) {
    this.ID = dcdID
    this.subTree = subTree
    this.path2This = subTree.index // including the its own dcdID
    this.level = levelOThis
    this.isTopChild = (this.level === 1)
    this.center = anchor
    this.cellRadius = cellRadius
    this.polygonCreator = polygonCreator
    this.numberODCD = subTree.dict.length
    this.glbTraversalOrder = subTree.data.glbTraversalOrder
    this.allLeaves = new Map() // leafName - node
    this.altitude
    this.contour
    this.occupied = new Map() // position ('i_j') - leafName
    this.neighbors = new Set() // position ('i_j')
    this.cls = Data.subHierClusters[this.path2This[0]]
    this.subClsNum = countSubCls(this.cls)
    this.alternativeMap = new Map() // position ('i_j') - leafName
    // layout 2 不存在省被分割的情况，但是形状没有layout 1好看
    this.layout1 = true
    this.initialize()

    function countSubCls(cls) {
      let num = 0
      for (let i = 0; i < cls.length; i++) {
        if (Array.isArray(cls[i])) {
          num++
        }
      }
      return num
    }
  }

  initialize () {
    // layout the center
    if (this.isTopChild) {
      this.centerLeafName = this.subTree.data.centerLeafName[0]
      this.center.ID = this.centerLeafName // update the center
      this.layoutLeaf(this.centerLeafName, this.center)
    }
  }

  layoutLeaf (leafName, leafNode) {
    this.allLeaves.set(leafName, leafNode) // update allLeaves
    this.updateRecords(leafName, leafNode)
  }

  updateRecords (leafName, leafNode) {
    let leafPosition = leafNode.position.i + '_' + leafNode.position.j
    this.occupied.set(leafPosition, leafName) // update the occupied list

    this.alternativeMap.delete(leafPosition)

    this.neighbors.delete(leafPosition)
    for (let neighbor of leafNode.neighbors) {
      let nghPosition = neighbor[1] // [nghAngle, nghPosition]
      let nghPositionInStore = nghPosition[0] + '_' + nghPosition[1]
      if (!this.occupied.has(nghPositionInStore)) {
        this.neighbors.add(nghPositionInStore)
      }
    }
  }

  layoutAll (distMatrix, existingList, forbiddenList) {
    const self = this
    let prevLeafPositions = []
    let sameCluster = false
    for (let traversalOrder = 0; traversalOrder < this.numberODCD; traversalOrder++) {
      let leafName = this.glbTraversalOrder[traversalOrder] // the alternative leaf
      if (leafName === this.centerLeafName) {
        continue
      }
      let nextLeafName = null
      if (traversalOrder < this.numberODCD - 1) {
        nextLeafName = this.glbTraversalOrder[traversalOrder + 1]
        if (nextLeafName === this.centerLeafName) {
          if (traversalOrder < this.numberODCD - 2) {
            nextLeafName = this.glbTraversalOrder[traversalOrder + 2]
          } else {
            nextLeafName = null
          }
        }
      }
      
      let alternativeList = new Set() // alternatives - position

      let leafPosition
      this.getAltPositions(leafName, nextLeafName, existingList, forbiddenList, alternativeList)
      if (this.layout1) {
        leafPosition = this.getLeafPosition1(alternativeList)
      } else {
        leafPosition = this.getLeafPosition2(prevLeafPositions, sameCluster, alternativeList)
        prevLeafPositions.push(JSON.parse(JSON.stringify(leafPosition)))
        sameCluster = checkIfSameCluster(leafName, nextLeafName)
        if (!sameCluster) {
          prevLeafPositions = []
        }
      }

      // this.getAltPositions(existingList, forbiddenList, alternativeList)
      // let weights = new Map() // position - leaf2leafWeights
      // this.getAltWeights(distMatrix, existingList, leafName, weights)
      // let leafPosition = this.getLeafPosition(alternativeList, weights)
      if (isNaN(leafPosition[0]) || isNaN(leafPosition[1])) {
        console.error('top tree: ' + this.ID + ' - leaf: ' + leafName)
      }
      let leafNode = this.polygonCreator(leafName, this.cellRadius, leafPosition)
      this.layoutLeaf(leafName, leafNode)
    }

    function checkIfSameCluster (leafName, nextLeafName) {
      let id = findIndex(leafName, self.cls)
      let nextId = findIndex(nextLeafName, self.cls)
      if (typeof id === 'string' && typeof nextId === 'string') {
        return id.substr(0, 1) === nextId.substr(0, 1)
      }
      return false
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
  }

  // getAltPositions (existingList, forbiddenList, alternativeList) {
  //   for (let neighbor of this.neighbors) {
  //     if (!existingList.has(neighbor) && !forbiddenList.has(neighbor)) {
  //       alternativeList.add(neighbor)
  //     }
  //   }
  // }

  getAltPositions (leafName, nextLeafName, existingList, forbiddenList, alternativeList) {
    for (let neighbor of this.neighbors) {
      if (!existingList.has(neighbor) && !forbiddenList.has(neighbor)) {
        alternativeList.add(neighbor)
        this.alternativeMap.set(neighbor, leafName)
      }
    }

    let id = findIndex(leafName, this.cls)
    let nextId = findIndex(nextLeafName, this.cls)
    let equal = false
    if (typeof id === 'string' && typeof nextId === 'string') {
      id = id.substr(0, 1)
      nextId = nextId.substr(0, 1)
      if (Number(id) < this.subClsNum && Number(nextId) < this.subClsNum) {
        equal = id === nextId
      } else {
        equal = true
      }
    }
    if (!equal) {
      this.neighbors.clear()
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
  }

  getLeafPosition1 (alternativeList) {
    let firstAlternative = alternativeList.values().next().value.split('_')
    return [parseInt(firstAlternative[0]), parseInt(firstAlternative[1])]
  }

  getLeafPosition2 (prevLeafPositions, sameCluster, alternativeList) {
    let leafPos
    let breakFlag = false
    if (sameCluster) {
      for (let i = 0; i < prevLeafPositions.length; i++) {
        let prevPos = { i: prevLeafPositions[i][0], j: prevLeafPositions[i][1] }
        let prevLeafNeighbors = Array.from(getNeighborsInPosition(prevPos).values())
        for (let i = 0; i < prevLeafNeighbors.length; i++) {
          let prevLeafNeighbor = `${prevLeafNeighbors[i][0]}_${prevLeafNeighbors[i][1]}`
          if (alternativeList.has(prevLeafNeighbor)) {
            leafPos = prevLeafNeighbor.split('_')
            breakFlag = true
            break
          }
        }
        if (breakFlag) {
          break
        }
      }
      if (leafPos === undefined) {
        leafPos = alternativeList.values().next().value.split('_')
      }
    } else {
      leafPos = alternativeList.values().next().value.split('_')
    }

    function getNeighborsInPosition (position) {
      let neighbors = new Map() // map: direction in degree (key) - position (value)
      let intPos = position
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
      neighbors.set(0, [intPos.i + x0, intPos.j])
      neighbors.set(60, [intPos.i + x1, intPos.j + 1])
      neighbors.set(120, [intPos.i + x2, intPos.j + 1])
      neighbors.set(180, [intPos.i + x3, intPos.j])
      neighbors.set(240, [intPos.i + x2, intPos.j - 1])
      neighbors.set(300, [intPos.i + x1, intPos.j - 1])
      return neighbors
    }
    return [parseInt(leafPos[0]), parseInt(leafPos[1])]
  }

  // getLeafPosition (alternativeList, weights) {
  //   let scoreFunc = (thisCoords, thatCoords, weight) => {
  //     let distX = thisCoords[0] - thatCoords[0]
  //     let distY = thisCoords[1] - thatCoords[1]
  //     let distance = Math.sqrt(Math.pow(distX, 2) + Math.pow(distY, 2))
  //     let angle = distX === 0 ? (Math.PI / 2) : Math.atan(distY / distX)
  //     let scoreValue = weight / (distance * distance)
  //     return [scoreValue * Math.cos(angle), scoreValue * Math.sin(angle)]
  //   }
  //   let maxScore = -Infinity
  //   let leafPosition
  //   for (let position of alternativeList) {
  //     let thisPosition = position.split('_')
  //     let thisCoords = this.center.getCoordinatesByPosition(this.cellRadius, thisPosition)
  //     let score = [0, 0]
  //     for (let p2w of weights) {
  //       let thatPosition = p2w[0].split('_')
  //       let thatCoords = this.center.getCoordinatesByPosition(this.cellRadius, thatPosition)
  //       let thatScore = scoreFunc(thisCoords, thatCoords, p2w[1])
  //       score = [score[0] + thatScore[0], score[1] + thatScore[1]] // add up the forces
  //     }
  //     let scoreValue = Math.sqrt(score[0] * score[0] + score[1] * score[1])
  //     if (scoreValue > maxScore) {
  //       maxScore = scoreValue
  //       leafPosition = thisPosition
  //     }
  //   }
  //   return [parseInt(leafPosition[0]), parseInt(leafPosition[1])]
  // }

  getAltWeights (distMatrix, existingList, thisLeaf, weights) {
    let weightFunc = (dist) => {
      return 1 / (dist * dist)
    }
    // weights of the siblings (leafs in the same subtree)
    for (let leafPosition of this.occupied) {
      let distance = distMatrix[thisLeaf][leafPosition[1]]
      weights.set(leafPosition[0], weightFunc(distance))
    }
    // weights of the others (existing list)
    for (let leafPosition of existingList) {
      let distance = distMatrix[thisLeaf][leafPosition[1]]
      weights.set(leafPosition[0], weightFunc(distance))
    }
  }

  move (moveVector) {
    this.occupied.clear()
    this.neighbors.clear()
    for (let leaf of this.allLeaves) {
      leaf[1].move(moveVector)
      this.updateRecords(leaf[0], leaf[1])
    }
    return this.occupied
  }
}