"""List 1.2 km NAIP request boxes covering a band along the route."""
import sys, os, json, math
import numpy as np
from scipy.spatial import cKDTree
sys.path.insert(0, os.path.dirname(__file__))
from geo import *
OUT, DST = sys.argv[1], sys.argv[2]
BOX, BAND, PX = 1.2, 0.17, 2000
rc = np.load(f"{OUT}/route_center.npy")[:, :2]
tree = cKDTree(rc)
nx = int(math.ceil(WKM / BOX)); ny = int(math.ceil(HKM / BOX))
boxes = []
for j in range(ny):
    for i in range(nx):
        x0 = -WKM / 2 + i * BOX; y0 = HKM / 2 - (j + 1) * BOX
        gx, gy = np.meshgrid(np.linspace(x0, x0 + BOX, 13), np.linspace(y0, y0 + BOX, 13))
        d, _ = tree.query(np.c_[gx.ravel(), gy.ravel()])
        if d.min() < BAND + 0.1:
            lo0, la0 = to_ll(x0, y0); lo1, la1 = to_ll(x0 + BOX, y0 + BOX)
            boxes.append({"i": i, "j": j, "km": [x0, y0, x0 + BOX, y0 + BOX], "ll": [float(lo0), float(la0), float(lo1), float(la1)]})
json.dump(boxes, open(f"{DST}/boxes.json", "w"))
with open(f"{DST}/list.txt", "w") as f:
    for b in boxes:
        name = f"{DST}/n_{b['i']}_{b['j']}.jpg"
        if os.path.exists(name) and os.path.getsize(name) > 50000: continue
        lo0, la0, lo1, la1 = b["ll"]
        f.write(f'url="https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage?bbox={lo0:.6f},{la0:.6f},{lo1:.6f},{la1:.6f}&bboxSR=4326&imageSR=4326&size={PX},{PX}&format=jpg&compressionQuality=88&f=image"\noutput="{name}"\n')
print(len(boxes))
