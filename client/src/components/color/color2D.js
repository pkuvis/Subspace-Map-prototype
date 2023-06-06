const colormap = require('./bremm.png')

var Color2D = {}

Color2D.dimensions = {
  width: 512,
  height: 512
}

Color2D.colormap = colormap

Color2D.context = null

Color2D.init = function (callback) {
  let canvas = document.createElement('canvas')
  canvas.id = 'colormap'
  canvas.width = String(Color2D.dimensions.width)
  canvas.height = String(Color2D.dimensions.height)
  canvas.style = 'display:none'
  document.body.appendChild(canvas)

  Color2D.context = canvas.getContext('2d')

  let imgObj = new Image()
  imgObj.onload = function () {
    Color2D.context.drawImage(imgObj, 0, 0)
    callback()
  }
  imgObj.src = Color2D.colormap
}

Color2D.ranges = {
  x: [0, 1],
  y: [0, 1]
}

Color2D.getScaledX = function (x) {
  let val = (x + 1 - (Color2D.ranges.x[0] + 1)) /
    (Color2D.ranges.x[1] + 1 - (Color2D.ranges.x[0] + 1))
  return val * (Color2D.dimensions.width - 1)
}

Color2D.getScaledY = function (y) {
  let val = (y + 1 - (Color2D.ranges.y[0] + 1)) /
    (Color2D.ranges.y[1] + 1 - (Color2D.ranges.y[0] + 1))
  return val * (Color2D.dimensions.height - 1)
}

Color2D.setColormap = function (colormap, callback) {
  Color2D.colormap = colormap
  if (document.getElementById('colormap') !== null) {
    document.getElementById('colormap').outerHTML = ''
    delete document.getElementById('colormap')
  }
  Color2D.init(callback)
}

Color2D.getColor = function (x, y) {
  let color = Color2D.context.getImageData(Color2D.getScaledX(x), Color2D.getScaledY(y), 1, 1)
  let r = color.data[0]
  let g = color.data[1]
  let b = color.data[2]
  return [r, g, b]
}

export default Color2D
