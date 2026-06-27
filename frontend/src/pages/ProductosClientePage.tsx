import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useCart } from "../context/CartContext";
import { useCartStore } from "../stores/cartStore";
import { useProductosWS } from "../hooks/useProductosWS";
import type { Categoria } from "../models/Categoria";
import type { Producto } from "../models/Producto";
import { categoriaService, cloudinaryThumb, getProductosPublic, reservarStock } from "../services/api";
import { SkeletonPage } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Toggle } from "../components/ui/Toggle";
import { SidebarCart } from "../components/SidebarCart";

const FILTROS_KEY = "productos_cliente_filtros";

function loadFiltros() {
  try {
    const raw = sessionStorage.getItem(FILTROS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveFiltros(filtros: { search: string; categoriaFilter: string; soloDisponibles: boolean }) {
  sessionStorage.setItem(FILTROS_KEY, JSON.stringify(filtros));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}

function getImageUrl(producto: Producto): string {
  if (producto.imagenes_url && producto.imagenes_url.length > 0 && producto.imagenes_url[0]) {
    return cloudinaryThumb(producto.imagenes_url[0], 600, 400);
  }
  return "https://images.unsplash.com/photo-1543332164-6e82f355badc?auto=format&fit=crop&w=800&q=80";
}

export function ProductosClientePage(): JSX.Element {
  const { agregarProducto } = useCart();
  const itemCount = useCartStore((s) => s.itemCount());
  const filtrosIniciales = loadFiltros();
  const [search, setSearch] = useState(filtrosIniciales.search ?? "");
  const [categoriaFilter, setCategoriaFilter] = useState(filtrosIniciales.categoriaFilter ?? "");
  const [soloDisponibles, setSoloDisponibles] = useState(filtrosIniciales.soloDisponibles ?? false);
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set());
  const [cartOpen, setCartOpen] = useState(false);
  const queryClient = useQueryClient();

  const catIdParam = categoriaFilter ? parseInt(categoriaFilter, 10) : undefined;

  const productosQuery = useQuery({
    queryKey: ["productos", "cliente-catalogo", catIdParam],
    queryFn: () => getProductosPublic(0, 100, catIdParam),
    placeholderData: (prev) => prev,
  });

  const categoriasQuery = useQuery({
    queryKey: ["categorias", "cliente"],
    queryFn: () => categoriaService.getAll(0, 100),
  });

  const productos = productosQuery.data?.data ?? [];
  const categorias = categoriasQuery.data?.data ?? [];

  const filtrados = useMemo(() => {
    let items = productos;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((p) => p.nombre.toLowerCase().includes(q));
    }
    if (soloDisponibles) {
      items = items.filter((p) => {
        const stockOk = p.stock_disponible === null || p.stock_disponible > 0;
        return p.disponible && stockOk;
      });
    }
    return items;
  }, [productos, search, categoriaFilter, soloDisponibles]);

  useEffect(() => {
    saveFiltros({ search, categoriaFilter, soloDisponibles });
  }, [search, categoriaFilter, soloDisponibles]);

  useProductosWS({
    onEvent: (data) => {
      if (data && typeof data === "object" && "event" in data && (data.event === "PRODUCTO_UPDATED" || data.event === "INGREDIENTE_UPDATED")) {
        toast.info("Catálogo actualizado");
      }
    },
  });

  const handleAddToCart = async (producto: Producto) => {
    if (addingIds.has(producto.id)) return;
    const stockOk = producto.stock_disponible === null || producto.stock_disponible > 0;
    if (!producto.disponible || !stockOk) {
      toast.error("Sin stock disponible");
      return;
    }
    setAddingIds((prev) => new Set(prev).add(producto.id));
    try {
      await reservarStock(producto.id, 1);
      agregarProducto({
        producto_id: producto.id,
        nombre: producto.nombre,
        precio: Number(producto.precio_base),
        cantidad: 1,
        imagen: producto.imagenes_url?.[0] ?? undefined,
      });
      toast.success("Producto agregado al carrito");
    } catch {
      toast.error("Sin stock disponible");
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(producto.id);
        return next;
      });
    }
  };

  if (productosQuery.isLoading) {
    return <SkeletonPage />;
  }

  if (productosQuery.isError) {
    return <p className="text-red-600">No se pudieron cargar los productos.</p>;
  }

  if (productos.length === 0) {
    return <EmptyState icon="🍽️" title="Productos" description="No hay productos disponibles por ahora." />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900 dark:text-brand-300">Productos</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">Explora el catálogo y agrega productos al carrito.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCartOpen(true)}
          className="relative"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
          Ver carrito
          {itemCount > 0 && (
            <span className="absolute -right-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-400 text-xs font-bold text-white">
              {itemCount}
            </span>
          )}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <Input
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefixIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
        <Select
          value={categoriaFilter}
          onChange={(e) => setCategoriaFilter(e.target.value)}
          options={categorias
            .filter((c: Categoria) => c.activo)
            .map((c: Categoria) => ({ value: String(c.id), label: c.nombre }))}
          placeholder="Todas las categorías"
        />
        <Toggle
          label="Solo disponibles"
          checked={soloDisponibles}
          onChange={setSoloDisponibles}
        />
      </div>

      {filtrados.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-gray-300">No se encontraron productos con esos filtros.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((producto, index) => {
            const stockDisponible = producto.stock_disponible;
            const tieneStock = stockDisponible === null || stockDisponible > 0;
            const puedeAgregar = producto.disponible && tieneStock;
            const deshabilitado = !puedeAgregar;
            const isFeatured = index === 0;

            return (
              <div
                key={producto.id}
                className={isFeatured ? "sm:col-span-2 sm:row-span-2" : ""}
              >
                <Card
                  variant={deshabilitado ? "default" : "interactive"}
                  padding="none"
                  className={`flex h-full cursor-pointer flex-col overflow-hidden ${deshabilitado ? "opacity-55 grayscale" : ""}`}
                  onClick={() => handleAddToCart(producto)}
                >
                  <div className="relative">
                    <img
                      src={getImageUrl(producto)}
                      alt={producto.nombre}
                      className={`w-full object-cover ${isFeatured ? "h-72 sm:h-full" : "h-44"}`}
                      loading="lazy"
                    />
                    {deshabilitado ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="rounded-lg bg-red-600 px-3 py-1 text-sm font-bold text-white shadow-lg">Sin stock</span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-brand-500/60 opacity-0 transition-opacity duration-200 hover:opacity-100">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg">
                          <svg className="h-7 w-7 text-brand-500 dark:text-brand-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-brand-950 dark:text-brand-200">{producto.nombre}</h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">{producto.descripcion || "Sin descripción"}</p>
                    </div>

                    <div className="mt-auto flex items-center justify-between">
                      <span className="font-bold text-brand-600 dark:text-brand-400">{formatCurrency(Number(producto.precio_base))}</span>
                      <Badge variant="solid" color={puedeAgregar ? "green" : "red"}>{puedeAgregar ? "Disponible" : "Sin stock"}</Badge>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      <SidebarCart open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
