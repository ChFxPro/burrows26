"""(Re)build terrain heights, corridor cells and road meshes inside Blender from prep2 outputs."""
import bpy, bmesh, numpy as np, json, os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "assets", "source", "out")  # build data (scripts/build/prep*.py write it)
D = bpy.data

def clear_collection(name):
    c = D.collections.get(name)
    if c:
        for o in list(c.objects):
            me = o.data
            D.objects.remove(o, do_unlink=True)
            if me and me.users == 0:
                for m in list(me.materials):
                    if m and m.users <= 1 and m.name.startswith("MAT_Cell_"):
                        for nd in m.node_tree.nodes:
                            if nd.type == 'TEX_IMAGE' and nd.image and nd.image.users <= 1: D.images.remove(nd.image)
                        D.materials.remove(m)
                D.meshes.remove(me)
    return c

def mesh_from(name, verts, quads, uvs_per_vert, mat):
    me = D.meshes.new(name)
    me.vertices.add(len(verts)); me.vertices.foreach_set("co", np.asarray(verts, np.float32).ravel())
    nf = len(quads)
    me.loops.add(nf * 4); me.loops.foreach_set("vertex_index", np.asarray(quads, np.int32).ravel())
    me.polygons.add(nf); me.polygons.foreach_set("loop_start", np.arange(0, nf * 4, 4, dtype=np.int32))
    me.uv_layers.new(name="UVMap").data.foreach_set("uv", np.asarray(uvs_per_vert, np.float32)[np.asarray(quads).ravel()].ravel())
    me.polygons.foreach_set("use_smooth", np.ones(nf, bool)); me.update()
    if mat: me.materials.append(mat)
    return me

# terrain heights
ter = D.objects["Terrain_WNC"]; me = ter.data
HL = np.load(f"{OUT}/height_mesh_lowered.npy")
co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
co[:, 2] = HL.ravel(); me.vertices.foreach_set("co", co.ravel()); me.update()
sat = D.images.get("WNC_Satellite")
if sat: sat.filepath = f"{OUT}/base_sat.jpg"; sat.reload()

# corridor cells
col = clear_collection("Corridor_HiRes")
meta = json.load(open(f"{OUT}/cells/cells.json")); n = meta["n"]
idx = np.arange(n * n).reshape(n, n)
quads = np.stack([idx[:-1, :-1].ravel(), idx[1:, :-1].ravel(), idx[1:, 1:].ravel(), idx[:-1, 1:].ravel()], -1)
U, V = np.meshgrid(np.linspace(0, 1, n), np.linspace(1, 0, n)); uvv = np.stack([U, V], -1).reshape(-1, 2)
base = D.materials["MAT_Terrain"]
for c in meta["cells"]:
    i, j = c["i"], c["j"]; x0, y0, x1, y1 = c["box"]
    Z = np.load(f"{OUT}/cells/z_{i}_{j}.npy")
    X, Y = np.meshgrid(np.linspace(x0, x1, n), np.linspace(y1, y0, n))
    m = base.copy(); m.name = f"MAT_Cell_{i}_{j}"
    im = D.images.load(f"{OUT}/cells/tex_{i}_{j}.jpg"); im.name = f"Cell_{i}_{j}"
    for nd in m.node_tree.nodes:
        if nd.type == 'TEX_IMAGE': nd.image = im; nd.interpolation = 'Cubic'
        if nd.type == 'BUMP': nd.inputs["Strength"].default_value = 0.0
    me = mesh_from(f"Cell_{i}_{j}", np.stack([X, Y, Z], -1).reshape(-1, 3), quads, uvv, m)
    col.objects.link(D.objects.new(f"Cell_{i}_{j}", me))

# roads
rc = clear_collection("Roads")
Vr = np.load(f"{OUT}/route_road_verts.npy"); ns = len(Vr)
dist = np.r_[0, np.cumsum(np.hypot(*np.diff(Vr[:, 1, :2], axis=0).T))]
b = np.arange(ns - 1) * 4
q = np.concatenate([np.stack([b + k, b + k + 4, b + k + 5, b + k + 1], -1) for k in range(3)])
uv = np.stack([np.tile([-0.12, 0.0, 1.0, 1.12], ns), np.repeat(dist, 4)], -1)
rc.objects.link(D.objects.new("Route_Road", mesh_from("Route_Road", Vr.reshape(-1, 3), q, uv, D.materials["MAT_RouteRoad"])))
H = np.load(f"{OUT}/highways.npy", allow_pickle=True)
allv, allq, alluv, off = [], [], [], 0
for run in H:
    k = len(run); d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(run[:, 0, :2], axis=0), axis=1))]
    allv.append(run.reshape(-1, 3)); bb = off + np.arange(k - 1) * 2
    allq.append(np.stack([bb, bb + 1, bb + 3, bb + 2], -1))     # counter-clockwise (normals up)
    alluv.append(np.stack([np.tile([0.0, 1.0], k), np.repeat(d, 2)], -1)); off += 2 * k
rc.objects.link(D.objects.new("Highways", mesh_from("Highways", np.concatenate(allv), np.concatenate(allq), np.concatenate(alluv), D.materials["MAT_Highway"])))
result_info = {"cells": len(col.objects)}
