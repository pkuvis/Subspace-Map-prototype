let GeoElements = {}
let exportClass = (className) => {
  return (...params) => {
    return new className(...params)
  }
}

class Point {
  constructor (externalID, coordinates) {
    this.type = 'point'
    this.ID = externalID
    this.tolerance = Number.EPSILON * 100
    this.coordinates = this.getCoordinates(coordinates)
  }

  getCoordinates (coordinates) {
    let x = coordinates[0]
    let y = coordinates[1]
    if (Math.abs(x) < this.tolerance) { x = 0 }
    if (Math.abs(y) < this.tolerance) { y = 0 }
    return { x: x, y: y }
  }
}
GeoElements.Point = exportClass(Point)

class Edge {
  constructor (externalID, startCoordinates, endCoordinates, nghPositions) {
    this.type = 'edge'
    this.ID = externalID
    this.start = GeoElements.Point(0, startCoordinates)
    this.end = GeoElements.Point(1, endCoordinates)
    this.length = this.getLength()
    this.tolerance = Number.EPSILON * 100
    this.nghPositions = this.getNeighbors(nghPositions)
  } // end of constructor of Edge

  // get the length of the edge
  getLength () {
    let start = this.start
    let end = this.end
    return Math.sqrt(Math.pow(end.coordinates.x - start.coordinates.x, 2) + Math.pow(end.coordinates.y - start.coordinates.y, 2))
  } // end of getLength

  // whether this edge is same to another edge
  sameTo (thatEdge) {
    if (this.nghPositions != null && thatEdge.nghPositions != null) {
      return this.nghPositions === thatEdge.nghPositions
    } else {
      return this.compareWith(thatEdge)
    }
  } // end of sameTo

  // compare this edge  with another edge
  compareWith (thatEdge, compareFunc, direction = false) {
    let s2s = Math.sqrt(Math.pow(this.start.coordinates.x - thatEdge.start.coordinates.x, 2) + Math.pow(this.start.coordinates.y - thatEdge.start.coordinates.y, 2))
    let e2e = Math.sqrt(Math.pow(this.end.coordinates.x - thatEdge.end.coordinates.x, 2) + Math.pow(this.end.coordinates.y - thatEdge.end.coordinates.y, 2))
    let s2e = Math.sqrt(Math.pow(this.start.coordinates.x - thatEdge.end.coordinates.x, 2) + Math.pow(this.start.coordinates.y - thatEdge.end.coordinates.y, 2))
    let e2s = Math.sqrt(Math.pow(this.end.coordinates.x - thatEdge.start.coordinates.x, 2) + Math.pow(this.end.coordinates.y - thatEdge.start.coordinates.y, 2))
    if (compareFunc == null) {
      if (!direction) {
        return (s2s < this.tolerance && e2e < this.tolerance) || (s2e < this.tolerance && e2s < this.tolerance)
      } else {
        return (s2s < this.tolerance && e2e < this.tolerance)
      }
    } else {
      return compareFunc.call(this, [s2s, e2e], [s2e, e2s])
    }
  } // end of compare

  // connect this edge with another edge
  connectTo (thatEdge) {
    let compareFunc = function ([s2s, e2e], [s2e, e2s]) {
      if (s2s < this.tolerance && e2e < this.tolerance) {
        return [this.start, this.end]
      }
      if (s2e < this.tolerance && e2s < this.tolerance) {
        return [this.start, this.end]
      }
      if (s2s < this.tolerance) {
        return [this.end, this.start, thatEdge.end]
      }
      if (e2s < this.tolerance) {
        return [this.start, this.end, thatEdge.end]
      }
      if (e2e < this.tolerance) {
        return [this.start, this.end, thatEdge.start]
      }
      if (s2e < this.tolerance) {
        return [this.end, this.start, thatEdge.start]
      }
      return false
    }
    return this.compareWith(thatEdge, compareFunc)
  } // end of connectTo

  getNeighbors (nghPositions) {
    if (nghPositions == null) {
      return null
    } else {
      let neighbors = ''
      if (nghPositions[0][0] < nghPositions[1][0]) {
        neighbors = [nghPositions[0].join(','), nghPositions[1].join(',')].join('_')
      }
      if (nghPositions[0][0] > nghPositions[1][0]) {
        neighbors = [nghPositions[1].join(','), nghPositions[0].join(',')].join('_')
      }
      if (nghPositions[0][0] === nghPositions[1][0]) {
        if (nghPositions[0][1] < nghPositions[1][1]) {
          neighbors = [nghPositions[0].join(','), nghPositions[1].join(',')].join('_')
        } else {
          neighbors = [nghPositions[1].join(','), nghPositions[0].join(',')].join('_')
        }
      }
      return neighbors
    }
  }
}
GeoElements.Edge = exportClass(Edge)

class Path {
  constructor (externalID, points, closed) {
    this.type = 'path'
    this.ID = externalID
    this.points = points
    this.closed = closed
  }
}
GeoElements.Path = exportClass(Path)

GeoElements.Methods = {
  getPathsByEdges: function (edges) {
    // indices
    let indices = []
    for (let i = 0; i < edges.length; i++) {
      indices.push(i)
    }
    let currentEdge = edges[indices[0]]
    indices.splice(0, 1)
    // paths
    let paths = []
    paths.push([])
    let isNewPath = true
    let pathID = 0
    // while there are still edges, connect them
    while (indices.length > 0) {
      let matchFound = false
      for (let i = 0; i < indices.length; i++) { // loop until a match is found
        let connectPath = currentEdge.connectTo(edges[indices[i]])
        if (connectPath !== false && connectPath != null) {
          matchFound = true // found the match
          if (isNewPath) {
            // new path:   put in the whole path
            isNewPath = false
            paths[pathID].push(...connectPath)
          } else {
            // old path:   put in the last point
            if (connectPath[2] == null) {
              console.log(currentEdge, edges[indices[i]])
            }
            paths[pathID].push(connectPath[2])
          }
          currentEdge = edges[indices[i]]
          indices.splice(i, 1)
          break
        }
      }
      if (!matchFound) { // match not found
        // the old edge is abandoned
        // indices
        currentEdge = edges[indices[0]]
        indices.splice(0, 1)
        // paths
        paths.push([])
        isNewPath = true
        pathID++
      }
    }
    let Paths = []
    for (let i = 0; i < paths.length; i++) {
      if (paths[i].length === 0) { // an empty path
        continue
      }
      let newPath = GeoElements.Path(`Path_${Paths.length}`, paths[i], true)
      Paths.push(newPath)
    }
    return Paths
  }
}

export default GeoElements