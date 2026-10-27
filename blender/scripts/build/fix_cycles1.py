"""Headless fixes: overhead fog look, close-up focus, Cycles speed settings. Saves the file."""
import bpy
D = bpy.data; sc = bpy.context.scene

def fcurves(idb):
    ad = idb.animation_data
    if not ad or not ad.action: return []
    act = ad.action
    return list(act.fcurves) if hasattr(act, "fcurves") else [fc for l in act.layers for st in l.strips for cb in st.channelbags for fc in cb.fcurves]

# ---- fog: clouds + edge band only, neutral white ----
fm = D.materials["MAT_Fog"]; nt = fm.node_tree
pv = [n for n in nt.nodes if n.type == 'PRINCIPLED_VOLUME'][0]
master = nt.nodes["FogMaster"]
for fc in fcurves(nt):
    if fc.data_path in (pv.inputs["Color"].path_from_id("default_value"), master.outputs[0].path_from_id("default_value")):
        try: nt.animation_data.action.fcurves.remove(fc)
        except Exception:
            act = nt.animation_data.action
            for l in act.layers:
                for st in l.strips:
                    for cb in st.channelbags:
                        if fc in list(cb.fcurves): cb.fcurves.remove(fc)
pv.inputs["Color"].default_value = (0.93, 0.94, 0.97, 1)
master.outputs[0].default_value = 1.0
for n in nt.nodes:
    if n.type == 'MATH' and n.operation == 'MULTIPLY' and abs(n.inputs[1].default_value - 0.08) < 1e-4:
        n.inputs[1].default_value = 0.0          # valley layer off (mist pass covers chase shots)
    if n.type == 'MAP_RANGE' and abs(n.inputs["From Min"].default_value - 5.0) < 1e-3 and abs(n.inputs["From Max"].default_value - 1.0) < 1e-3:
        n.inputs["From Min"].default_value = 3.0; n.inputs["To Max"].default_value = 2.2
    if n.type == 'MATH' and n.operation == 'MULTIPLY' and abs(n.inputs[1].default_value - 1.6) < 1e-4:
        n.inputs[1].default_value = 2.4          # cloud deck density

# ---- close-up focus: focus on the branded surface, much smaller aperture ----
car = D.objects["Burrows_Vehicle"]
focus = {"CAM_CU_Front34": ((0.012, 0.004, 0.006), 22.0), "CAM_CU_Side": ((0.002, 0.0066, 0.0058), 22.0),
         "CAM_CU_RearLow": ((-0.016, 0.0, 0.0075), 22.0), "CAM_CU_Sign": ((-0.004, 0.0, 0.0165), 16.0)}
for nm, (loc, fs) in focus.items():
    cam = D.objects[nm]
    f = D.objects.get(nm + "_F") or D.objects.new(nm + "_F", None)
    if f.name not in D.collections["Burrows_Vehicle"].objects: D.collections["Burrows_Vehicle"].objects.link(f)
    f.parent = car; f.matrix_parent_inverse.identity(); f.location = loc
    cam.data.dof.focus_object = f; cam.data.dof.aperture_fstop = fs

# ---- Cycles speed ----
cy = sc.cycles
cy.samples = 40; cy.adaptive_threshold = 0.045; cy.adaptive_min_samples = 12
cy.volume_step_rate = 6.0; cy.volume_max_steps = 96
cy.max_bounces = 5; cy.diffuse_bounces = 2; cy.glossy_bounces = 2; cy.transparent_max_bounces = 8
sc.render.use_persistent_data = True
bpy.ops.wm.save_mainfile()
print("FIXED")
