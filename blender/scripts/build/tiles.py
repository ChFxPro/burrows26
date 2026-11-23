import math, os, sys, urllib.request, concurrent.futures as cf
Z=12; W,E,Sb,N=-84.0,-82.53,34.97,35.73
def tx(lon): return int((lon+180)/360*2**Z)
def ty(lat): r=math.radians(lat); return int((1-math.log(math.tan(r)+1/math.cos(r))/math.pi)/2*2**Z)
xs=range(tx(W),tx(E)+1); ys=range(ty(N),ty(Sb)+1)
out=sys.argv[1]
def get(xy):
    x,y=xy; p=f"{out}/{Z}_{x}_{y}.png"
    if not os.path.exists(p):
        urllib.request.urlretrieve(f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png",p)
    return p
with cf.ThreadPoolExecutor(16) as ex: list(ex.map(get,[(x,y) for x in xs for y in ys]))
print(Z,xs,ys,len(xs)*len(ys))
