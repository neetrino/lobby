# API modules

Each directory owns one functional boundary. Code outside a module must import only from that module's root `index.ts`; deep imports into its controllers, services, domain, persistence, DTOs, or event handlers are not allowed.

Modules expose only the smallest public surface needed by other modules. Database access and business rules remain private to their owning module.
