function quickSort(left, right, a, key) {
  if (left > right) return
  var i = left
  var j = right
  var benchMark = a[i]
  var temp
  while (i != j) {
    //移动 j
    while (a[j][key] >= benchMark[key] && i < j) j--
    //移动 i
    while (a[i][key] <= benchMark[key] && i < j) i++
    if (i < j) {
      temp = a[i]
      a[i] = a[j]
      a[j] = temp
    }
  }

  a[left] = a[i]
  a[i] = benchMark
  quickSort(left, i - 1, a, key)
  quickSort(i + 1, right, a, key)
}

var MakeSet = (function() {
  let set = new Set()
  return function(x) {
    x.parent = x
    x.rank = 0
    if (!set.has(x)) set.add(x)
    return set
  }
})()

//体会两个 Find 方法的不同
// function Find(x) {
//     if (x.parent != x)
//         Find(x.parent);
//     return x.parent;
// }

function Find(x) {
  if (x.parent != x) x.parent = Find(x.parent)
  return x.parent
}

function Union(u, v) {
  let uRoot = Find(u)
  let vRoot = Find(v)
  // 如果 u 和 v 在同一颗树
  if (uRoot == vRoot) return
  // 如果 u 和 v 不在同一颗树中，合并它们
  // 如果 uRoot 的层级比 vRoot 的小,将 uRoot 作为 vRoot 前驱节点
  if (uRoot.rank < vRoot.rank) uRoot.parent = vRoot
  // 如果 uRoot 的层级比 vRoot 的大,将 vRoot 作为 uRoot 前驱节点
  else if (uRoot.rank > vRoot.rank) vRoot.parent = uRoot
  //任选一个作为根节点
  else {
    vRoot.parent = uRoot
    uRoot.rank = uRoot.rank + 1
  }
}

function Kruskal(G) {
  let A = [] //A用于存放最小生成数所包含的边
  for (let x of G.V) {
    MakeSet(x)
  }
  //对G.E按照边的权中从小到大排序
  for (let e of G.E) {
    quickSort(0, G.E.length - 1, G.E, 'w')
  }
  for (let e of G.E) {
    let u = G.V[G.refer.get(e.u)]
    let v = G.V[G.refer.get(e.v)]
    if (Find(u) != Find(v)) {
      A.push(e)
      Union(u, v)
    }
  }
  return A
}

function Vertex() {
  if (!(this instanceof Vertex)) return new Vertex()
  this.edges = null //由顶点发出的所有边
  this.id = null //节点的唯一标识
  this.data = null //存放节点的数据
}

//数据结构 邻接链表-边
function Edge() {
  if (!(this instanceof Edge)) return new Edge()
  this.index = null //边所依附的节点的位置
  this.sibling = null
  this.w = null //保存边的权值
}

//数据结构 图-G
function Graph() {
  if (!(this instanceof Graph)) return new Graph()
  this.V = [] //节点集
  this.E = []
  this.refer = new Map() //字典 用来映射标节点的识符和数组中的位置
}
Graph.prototype = {
  constructor: Graph,
  //这里加进来的已经具备了边的关系
  //创建图的 节点
  initVertex: function(vertexs) {
    //创建节点并初始化节点属性 id
    for (let v of vertexs) {
      let vertex = Vertex()
      vertex.id = v.id
      this.V.push(vertex)
    }
    //初始化 字典
    for (let i in this.V) {
      this.refer.set(this.V[i].id, i)
    }
  },
  //建立图中 边 的关系
  initEdge: (function() {
    //创建链表，返回链表的第一个节点
    function createLink(index, len, edges, refer) {
      if (index >= len) return null
      let edgeNode = Edge()
      edgeNode.index = refer.get(edges[index].id) //边连接的节点 用在数组中的位置表示 参照字典
      edgeNode.w = edges[index].w //边的权值
      edgeNode.sibling = createLink(++index, len, edges, refer) //通过递归实现 回溯
      return edgeNode
    }
    return function(edges) {
      for (let field in edges) {
        let index = this.refer.get(field) //从字典表中找出节点在 V 中的位置
        let vertex = this.V[index] //获取节点
        vertex.edges = createLink(
          0,
          edges[field].length,
          edges[field],
          this.refer
        )
      }
    }
  })(),
  storageEdge: function(edges) {
    this.E = edges
  }
}

export {Graph, Kruskal}