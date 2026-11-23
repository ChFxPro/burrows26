"""Shared projection + corridor-cell definitions."""
import math, json
import numpy as np

W, E, S, N = -84.0, -82.53, 34.97, 35.73
LAT0, LON0 = (S + N) / 2, (W + E) / 2
KX = 111.32 * math.cos(math.radians(LAT0))
KY = 110.57
WKM, HKM = (E - W) * KX, (N - S) * KY
VEX = 2.0
CELL = 2.0          # km per corridor cell
BUF = 1.05          # cells kept if any point within this distance (km) of route
CORE, FADE = 0.72, 0.92  # hi-res terrain full strength inside CORE, blends to base by FADE


def to_km(lon, lat):
    return (np.asarray(lon) - LON0) * KX, (np.asarray(lat) - LAT0) * KY


def to_ll(x, y):
    return np.asarray(x) / KX + LON0, np.asarray(y) / KY + LAT0


def merc(lon, lat, z):
    n = 2 ** z
    px = (np.asarray(lon) + 180) / 360 * n
    r = np.radians(lat)
    py = (1 - np.log(np.tan(r) + 1 / np.cos(r)) / math.pi) / 2 * n
    return px, py  # in tile units


def route_xy(out):
    return np.load(f"{out}/route_xyz.npy")[:, :2]


def cells(out):
    from scipy.spatial import cKDTree
    R = route_xy(out)
    t = cKDTree(R)
    nx = int(math.ceil(WKM / CELL)); ny = int(math.ceil(HKM / CELL))
    keep = []
    for j in range(ny):
        for i in range(nx):
            x0 = -WKM / 2 + i * CELL; y1 = HKM / 2 - j * CELL
            gx, gy = np.meshgrid(np.linspace(x0, x0 + CELL, 9), np.linspace(y1 - CELL, y1, 9))
            d, _ = t.query(np.c_[gx.ravel(), gy.ravel()])
            if d.min() < BUF:
                keep.append((i, j, x0, y1 - CELL, x0 + CELL, y1))
    return keep
