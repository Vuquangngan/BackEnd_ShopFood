const swaggerJSDoc = require("swagger-jsdoc");
const S = "#/components/schemas/";
const bearer = [{ BearerAuth: [] }];
const json = (schema) => ({ required: true, content: { "application/json": { schema } } });
const ok = (description = "Success", schema) => schema ? ({ description, content: { "application/json": { schema } } }) : ({ description });
const pid = (name = "id", desc = "ID") => ({ name, in: "path", required: true, description: desc, schema: { type: "integer" } });
const tokenParam = { name: "token", in: "path", required: true, schema: { type: "string" } };
const spec = {
  openapi: "3.0.3",
  info: { title: "Garden Fresh API", version: "1.0.0", description: "Backend API documentation for the Garden Fresh grocery system." },
  servers: [{ url: "http://localhost:3000", description: "Local server" }],
  tags: [
    ["Auth","Registration, authentication, and session management"],
    ["Users","User profile and addresses"],
    ["Categories","Product categories"],
    ["Products","Products, search, and reviews"],
    ["Recipes","Recipes"],
    ["Cart","Shopping cart"],
    ["Coupons","Coupons"],
    ["Orders","Orders"],
    ["Payments","Mock online payments"],
    ["Uploads","File uploads"],
    ["Notifications","User notifications"],
    ["Dashboard","Admin dashboard"],
    ["Inventory","Warehouse, suppliers, and stock movements"],
    ["Chat","Customer support chat"]
  ].map(([name, description]) => ({ name, description })),
  components: {
    securitySchemes: { BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Paste token only. Bearer prefix is optional." } },
    schemas: {
      User: { type: "object", properties: { id: { type: "integer" }, username: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, avatar_url: { type: "string", nullable: true }, role: { type: "string" }, status: { type: "string" } } },
      Address: { type: "object", properties: { id: { type: "integer" }, full_name: { type: "string" }, phone: { type: "string" }, address_line: { type: "string" }, ward: { type: "string", nullable: true }, district: { type: "string", nullable: true }, city: { type: "string" }, is_default: { type: "boolean" } } },
      AuthLoginRequest: { type: "object", required: ["email","password"], properties: { email: { type: "string", example: "customer@shopfood.vn" }, password: { type: "string", example: "Customer@123456" }, device_name: { type: "string", example: "Postman Desktop" } } },
      AuthRegisterRequest: { type: "object", required: ["username","email","password"], properties: { username: { type: "string" }, email: { type: "string" }, password: { type: "string" } } },
      AuthRefreshRequest: { type: "object", required: ["refresh_token"], properties: { refresh_token: { type: "string" } } },
      ForgotPasswordRequest: { type: "object", required: ["email"], properties: { email: { type: "string" } } },
      ChangePasswordRequest: { type: "object", required: ["current_password","new_password"], properties: { current_password: { type: "string" }, new_password: { type: "string" } } },
      AuthResponse: { type: "object", properties: { message: { type: "string" }, token: { type: "string" }, access_token: { type: "string" }, refresh_token: { type: "string" }, refresh_token_expires_at: { type: "string", format: "date-time" }, user: { $ref: S + "User" } } },
      CategoryRequest: { type: "object", required: ["name","slug"], properties: { parent_id: { type: "integer", nullable: true }, name: { type: "string" }, slug: { type: "string" }, description: { type: "string", nullable: true } } },
      ProductRequest: { type: "object", required: ["name","slug","sku","price"], properties: { category_id: { type: "integer", description: "Nhap category_id neu ban dung ID danh muc" }, category_slug: { type: "string", description: "Nhap category_slug neu ban muon tao san pham theo slug danh muc, vi du trai-cay" }, name: { type: "string" }, slug: { type: "string" }, sku: { type: "string" }, price: { type: "number" }, sale_price: { type: "number", nullable: true }, stock_quantity: { type: "integer" }, unit: { type: "string" }, production_date: { type: "string", format: "date", nullable: true, example: "2026-05-19" }, expiration_date: { type: "string", format: "date", nullable: true, example: "2026-06-19" }, is_published: { type: "boolean" }, images: { type: "array", items: { oneOf: [{ type: "string" }, { type: "object" }] } } } },
      ProductReviewRequest: { type: "object", required: ["rating"], properties: { rating: { type: "integer", minimum: 1, maximum: 5 }, comment: { type: "string" } } },
      RecipeRequest: { type: "object", required: ["title","slug"], properties: { title: { type: "string" }, slug: { type: "string" }, description: { type: "string" }, image_url: { type: "string" }, prep_time_minutes: { type: "integer" }, cook_time_minutes: { type: "integer" }, servings: { type: "integer" }, difficulty: { type: "string" }, calories: { type: "integer" }, status: { type: "string" }, ingredients: { type: "array", items: { type: "object" } }, steps: { type: "array", items: { type: "object" } } } },
      RecipeReviewRequest: { type: "object", required: ["rating"], properties: { rating: { type: "integer", minimum: 1, maximum: 5 }, comment: { type: "string" } } },
      CartItemRequest: { type: "object", required: ["product_id","quantity"], properties: { product_id: { type: "integer" }, quantity: { type: "integer" } } },
      CartItemUpdateRequest: { type: "object", required: ["quantity"], properties: { quantity: { type: "integer" } } },
      CouponRequest: { type: "object", required: ["code","discount_type","discount_value"], properties: { code: { type: "string" }, description: { type: "string" }, campaign_metadata: { type: "string", nullable: true, description: "JSON thiet lap chien dich, apply_scope products/categories, san pham hoac danh muc ap dung, khung gio..." }, discount_type: { type: "string" }, discount_value: { type: "number" }, min_order_value: { type: "number" }, max_discount_value: { type: "number" }, usage_limit: { type: "integer" }, is_active: { type: "boolean" } } },
      CouponValidateRequest: { type: "object", required: ["code"], properties: { code: { type: "string" }, subtotal: { type: "number" } } },
      CreateOrderRequest: { type: "object", required: ["customer_name","customer_phone","shipping_address","city"], properties: { customer_name: { type: "string" }, customer_phone: { type: "string" }, shipping_address: { type: "string" }, ward: { type: "string" }, district: { type: "string" }, city: { type: "string" }, note: { type: "string" }, payment_method: { type: "string" }, coupon_code: { type: "string" }, use_cart: { type: "boolean" }, items: { type: "array", items: { type: "object" } } } },
      OrderStatusRequest: { type: "object", properties: { status: { type: "string" }, payment_status: { type: "string" } } },
      ChatConversationRequest: { type: "object", properties: { customer_id: { type: "integer", nullable: true }, subject: { type: "string" } } },
      ChatMessageRequest: { type: "object", properties: { content: { type: "string" }, attachment_url: { type: "string", nullable: true }, message_type: { type: "string" } } },
      SupplierRequest: { type: "object", required: ["name","code"], properties: { name: { type: "string" }, code: { type: "string" }, contact_person: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, address: { type: "string" }, note: { type: "string" }, status: { type: "string" } } },
      InventoryDocumentRequest: { type: "object", required: ["type","items"], properties: { type: { type: "string", enum: ["receipt","adjustment_in","adjustment_out","damage","return_supplier"] }, supplier_id: { type: "integer", nullable: true }, reference_number: { type: "string" }, note: { type: "string" }, auto_complete: { type: "boolean" }, items: { type: "array", items: { type: "object", properties: { product_id: { type: "integer" }, quantity: { type: "integer" }, unit_cost: { type: "number", nullable: true }, note: { type: "string" } } } } } }
    }
  },
  paths: {}
};
const p = spec.paths;
const ref = (name) => ({ $ref: S + name });

p["/api/auth/register"] = { post: { tags: ["Auth"], summary: "Register a new account", requestBody: json(ref("AuthRegisterRequest")), responses: { 201: ok("Registration successful") } } };
p["/api/auth/login"] = { post: { tags: ["Auth"], summary: "Login", requestBody: json(ref("AuthLoginRequest")), responses: { 200: ok("Login thanh cong", ref("AuthResponse")) } } };
p["/api/auth/refresh"] = { post: { tags: ["Auth"], summary: "Refresh access token", requestBody: json(ref("AuthRefreshRequest")), responses: { 200: ok("Session refreshed successfully"), 401: ok("Refresh token is invalid or expired") } } };
p["/api/auth/logout"] = { post: { tags: ["Auth"], summary: "Logout current session", requestBody: json(ref("AuthRefreshRequest")), responses: { 200: ok("Logout successful") } } };
p["/api/auth/forgot-password"] = { post: { tags: ["Auth"], summary: "Forgot password", requestBody: json(ref("ForgotPasswordRequest")), responses: { 200: ok("Password reset request processed") } } };
p["/api/auth/change-password"] = { post: { tags: ["Auth"], summary: "Change password", security: bearer, requestBody: json(ref("ChangePasswordRequest")), responses: { 200: ok("Change password thanh cong") } } };

p["/api/users/me"] = {
  get: { tags: ["Users"], summary: "Get my profile", security: bearer, responses: { 200: ok("User information", ref("User")) } },
  put: { tags: ["Users"], summary: "Update my profile", security: bearer, requestBody: json({ type: "object", properties: { username: { type: "string" }, phone: { type: "string" }, avatar_url: { type: "string" } } }), responses: { 200: ok("Update successful") } }
};
p["/api/users/me/addresses"] = {
  get: { tags: ["Users"], summary: "List my addresses", security: bearer, responses: { 200: ok("Address list", { type: "array", items: ref("Address") }) } },
  post: { tags: ["Users"], summary: "Create a new address", security: bearer, requestBody: json({ type: "object", required: ["full_name","phone","address_line","city"], properties: { full_name: { type: "string" }, phone: { type: "string" }, address_line: { type: "string" }, ward: { type: "string" }, district: { type: "string" }, city: { type: "string" }, is_default: { type: "boolean" } } }), responses: { 201: ok("Address created successfully", ref("Address")) } }
};
p["/api/users/me/addresses/{addressId}"] = {
  put: { tags: ["Users"], summary: "Update address", security: bearer, parameters: [pid("addressId","ID dia chi")], requestBody: json({ type: "object", properties: { full_name: { type: "string" }, phone: { type: "string" }, address_line: { type: "string" }, ward: { type: "string" }, district: { type: "string" }, city: { type: "string" }, is_default: { type: "boolean" } } }), responses: { 200: ok("Update address thanh cong") } },
  delete: { tags: ["Users"], summary: "Delete address", security: bearer, parameters: [pid("addressId","ID dia chi")], responses: { 200: ok("Delete address thanh cong") } }
};
p["/api/users"] = { get: { tags: ["Users"], summary: "User list", security: bearer, parameters: [{ name: "keyword", in: "query", schema: { type: "string" } }, { name: "role", in: "query", schema: { type: "string" } }, { name: "status", in: "query", schema: { type: "string" } }], responses: { 200: ok("User list") } } };
p["/api/users/{id}"] = { get: { tags: ["Users"], summary: "User details", security: bearer, parameters: [pid("id","ID nguoi dung")], responses: { 200: ok("User information") } } };

p["/api/categories"] = {
  get: { tags: ["Categories"], summary: "Category list", responses: { 200: ok("Category list") } },
  post: { tags: ["Categories"], summary: "Create category", security: bearer, requestBody: json(ref("CategoryRequest")), responses: { 201: ok("Create category thanh cong") } }
};
p["/api/categories/{id}"] = {
  get: { tags: ["Categories"], summary: "Category details", parameters: [pid("id","ID danh muc")], responses: { 200: ok("Category details") } },
  put: { tags: ["Categories"], summary: "Update category", security: bearer, parameters: [pid("id","ID danh muc")], requestBody: json(ref("CategoryRequest")), responses: { 200: ok("Update category thanh cong") } },
  delete: { tags: ["Categories"], summary: "Delete category", security: bearer, parameters: [pid("id","ID danh muc")], responses: { 200: ok("Delete category thanh cong") } }
};

p["/api/products"] = {
  get: { tags: ["Products"], summary: "List products with search, filters, and pagination", parameters: [{ name: "keyword", in: "query", schema: { type: "string" } }, { name: "category_id", in: "query", schema: { type: "integer" } }, { name: "category_slug", in: "query", schema: { type: "string" } }, { name: "status", in: "query", schema: { type: "string" } }, { name: "min_price", in: "query", schema: { type: "number" } }, { name: "max_price", in: "query", schema: { type: "number" } }, { name: "in_stock", in: "query", schema: { type: "boolean" } }, { name: "is_featured", in: "query", schema: { type: "boolean" } }, { name: "page", in: "query", schema: { type: "integer" } }, { name: "limit", in: "query", schema: { type: "integer" } }, { name: "sort_by", in: "query", schema: { type: "string" } }], responses: { 200: ok("Product list") } },
  post: { tags: ["Products"], summary: "Create product", security: bearer, requestBody: json(ref("ProductRequest")), responses: { 201: ok("Create product thanh cong") } }
};
p["/api/products/{id}"] = {
  get: { tags: ["Products"], summary: "Product details", parameters: [pid("id","ID san pham")], responses: { 200: ok("Product details") } },
  put: { tags: ["Products"], summary: "Update product", security: bearer, parameters: [pid("id","ID san pham")], requestBody: json(ref("ProductRequest")), responses: { 200: ok("Update product thanh cong") } },
  delete: { tags: ["Products"], summary: "Delete product", security: bearer, parameters: [pid("id","ID san pham")], responses: { 200: ok("Delete product thanh cong") } }
};
p["/api/products/{id}/publish"] = { patch: { tags: ["Products"], summary: "Publish product for sale", security: bearer, parameters: [pid("id","ID san pham")], responses: { 200: ok("Product published") } } };
p["/api/products/{id}/unpublish"] = { patch: { tags: ["Products"], summary: "Hide product from sales channel", security: bearer, parameters: [pid("id","ID san pham")], responses: { 200: ok("Product unpublished") } } };
p["/api/products/{id}/reviews"] = {
  get: { tags: ["Products"], summary: "List product reviews", parameters: [pid("id","ID san pham")], responses: { 200: ok("Review list") } },
  post: { tags: ["Products"], summary: "Create or update a product review", security: bearer, parameters: [pid("id","ID san pham")], requestBody: json(ref("ProductReviewRequest")), responses: { 201: ok("Review submitted successfully") } }
};

p["/api/recipes"] = {
  get: { tags: ["Recipes"], summary: "Recipe list", responses: { 200: ok("Recipe list") } },
  post: { tags: ["Recipes"], summary: "Create recipe", security: bearer, requestBody: json(ref("RecipeRequest")), responses: { 201: ok("Create recipe thanh cong") } }
};
p["/api/recipes/{id}"] = {
  get: { tags: ["Recipes"], summary: "Recipe details", parameters: [pid("id","ID cong thuc")], responses: { 200: ok("Recipe details") } },
  put: { tags: ["Recipes"], summary: "Update recipe", security: bearer, parameters: [pid("id","ID cong thuc")], requestBody: json(ref("RecipeRequest")), responses: { 200: ok("Update recipe thanh cong") } },
  delete: { tags: ["Recipes"], summary: "Delete recipe", security: bearer, parameters: [pid("id","ID cong thuc")], responses: { 200: ok("Delete recipe thanh cong") } }
};
p["/api/recipes/{id}/favorite"] = { post: { tags: ["Recipes"], summary: "Toggle recipe favorite", security: bearer, parameters: [pid("id","ID cong thuc")], responses: { 200: ok("Recipe favorite updated successfully") } } };
p["/api/recipes/{id}/reviews"] = {
  post: { tags: ["Recipes"], summary: "Create or update a recipe review", security: bearer, parameters: [pid("id","ID cong thuc")], requestBody: json(ref("RecipeReviewRequest")), responses: { 200: ok("Recipe review submitted successfully") } },
  delete: { tags: ["Recipes"], summary: "Delete my recipe review", security: bearer, parameters: [pid("id","ID cong thuc")], responses: { 200: ok("Review deleted successfully") } }
};

p["/api/cart"] = { get: { tags: ["Cart"], summary: "Shopping cart hien tai cua toi", security: bearer, responses: { 200: ok("Shopping cart hien tai") } } };
p["/api/cart/items"] = { post: { tags: ["Cart"], summary: "Add product to cart", security: bearer, requestBody: json(ref("CartItemRequest")), responses: { 201: ok("Product added to cart successfully") } } };
p["/api/cart/items/{itemId}"] = {
  put: { tags: ["Cart"], summary: "Update cart item quantity", security: bearer, parameters: [pid("itemId","ID muc gio hang")], requestBody: json(ref("CartItemUpdateRequest")), responses: { 200: ok("Cart updated successfully") } },
  delete: { tags: ["Cart"], summary: "Delete a cart item", security: bearer, parameters: [pid("itemId","ID muc gio hang")], responses: { 200: ok("Product removed from cart") } }
};
p["/api/cart/clear"] = { delete: { tags: ["Cart"], summary: "Clear cart", security: bearer, responses: { 200: ok("Cart cleared") } } };

p["/api/coupons"] = {
  get: { tags: ["Coupons"], summary: "Coupon list", responses: { 200: ok("Coupon list") } },
  post: { tags: ["Coupons"], summary: "Create coupon", security: bearer, requestBody: json(ref("CouponRequest")), responses: { 201: ok("Create coupon thanh cong") } }
};
p["/api/coupons/validate"] = { post: { tags: ["Coupons"], summary: "Validate coupon", requestBody: json(ref("CouponValidateRequest")), responses: { 200: ok("Coupon validation result") } } };
p["/api/coupons/code/{code}"] = { get: { tags: ["Coupons"], summary: "Get coupon by code", parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }], responses: { 200: ok("Coupon information") } } };
p["/api/coupons/{id}"] = {
  get: { tags: ["Coupons"], summary: "Coupon details", parameters: [pid("id","ID ma giam gia")], responses: { 200: ok("Coupon details") } },
  put: { tags: ["Coupons"], summary: "Update coupon", security: bearer, parameters: [pid("id","ID ma giam gia")], requestBody: json(ref("CouponRequest")), responses: { 200: ok("Update coupon thanh cong") } },
  delete: { tags: ["Coupons"], summary: "Delete coupon", security: bearer, parameters: [pid("id","ID ma giam gia")], responses: { 200: ok("Delete coupon thanh cong") } }
};

p["/api/orders/my-orders"] = { get: { tags: ["Orders"], summary: "Orders cua toi", security: bearer, responses: { 200: ok("My order list") } } };
p["/api/orders"] = {
  get: { tags: ["Orders"], summary: "All orders", security: bearer, parameters: [{ name: "status", in: "query", schema: { type: "string" } }, { name: "payment_status", in: "query", schema: { type: "string" } }, { name: "user_id", in: "query", schema: { type: "integer" } }], responses: { 200: ok("Order list") } },
  post: { tags: ["Orders"], summary: "Create order", security: bearer, requestBody: json(ref("CreateOrderRequest")), responses: { 201: ok("Create order thanh cong") } }
};
p["/api/orders/{id}"] = {
  get: { tags: ["Orders"], summary: "Order details", security: bearer, parameters: [pid("id","ID don hang")], responses: { 200: ok("Order details") } },
  delete: { tags: ["Orders"], summary: "Delete order", security: bearer, parameters: [pid("id","ID don hang")], responses: { 200: ok("Delete order thanh cong") } }
};
p["/api/orders/{id}/payments"] = { get: { tags: ["Orders"], summary: "List order payment transactions", security: bearer, parameters: [pid("id","ID don hang")], responses: { 200: ok("Payment transaction list") } } };
p["/api/orders/{id}/payment-link"] = { post: { tags: ["Orders"], summary: "Create or reuse online payment link", security: bearer, parameters: [pid("id","ID don hang")], responses: { 201: ok("Payment link created successfully") } } };
p["/api/orders/{id}/status"] = { put: { tags: ["Orders"], summary: "Update order status", security: bearer, parameters: [pid("id","ID don hang")], requestBody: json(ref("OrderStatusRequest")), responses: { 200: ok("Update order status thanh cong") } } };

p["/api/uploads/images"] = { post: { tags: ["Uploads"], summary: "File uploads", security: bearer, requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", properties: { image: { type: "string", format: "binary" }, images: { type: "array", items: { type: "string", format: "binary" } } } } } } }, responses: { 201: ok("Upload successful") } } };

p["/api/notifications"] = { get: { tags: ["Notifications"], summary: "List current user notifications", security: bearer, responses: { 200: ok("Notification list") } } };
p["/api/notifications/unread-count"] = { get: { tags: ["Notifications"], summary: "Unread notification count", security: bearer, responses: { 200: ok("Unread notification count") } } };
p["/api/notifications/read-all"] = { post: { tags: ["Notifications"], summary: "Mark all notifications as read", security: bearer, responses: { 200: ok("Mark all notifications as read") } } };
p["/api/notifications/{id}/read"] = { post: { tags: ["Notifications"], summary: "Mark one notification as read", security: bearer, parameters: [pid("id","ID thong bao")], responses: { 200: ok("Notification marked as read") } } };

p["/api/dashboard/admin/overview"] = { get: { tags: ["Dashboard"], summary: "Admin dashboard", security: bearer, responses: { 200: ok("Dashboard data") } } };

p["/api/chat/conversations"] = {
  get: { tags: ["Chat"], summary: "Conversation list", security: bearer, responses: { 200: ok("Conversation list") } },
  post: { tags: ["Chat"], summary: "Create or get active conversation", security: bearer, requestBody: { content: { "application/json": { schema: ref("ChatConversationRequest") } } }, responses: { 201: ok("Conversation created or fetched successfully") } }
};
p["/api/chat/conversations/{id}"] = { get: { tags: ["Chat"], summary: "Conversation details", security: bearer, parameters: [pid("id","ID hoi thoai")], responses: { 200: ok("Conversation details") } } };
p["/api/chat/conversations/{id}/messages"] = {
  get: { tags: ["Chat"], summary: "Conversation message history", security: bearer, parameters: [pid("id","ID hoi thoai")], responses: { 200: ok("Message history") } },
  post: { tags: ["Chat"], summary: "Send message via REST", security: bearer, parameters: [pid("id","ID hoi thoai")], requestBody: json(ref("ChatMessageRequest")), responses: { 201: ok("Message sent successfully") } }
};
p["/api/chat/conversations/{id}/read"] = { post: { tags: ["Chat"], summary: "Mark all conversation messages as read", security: bearer, parameters: [pid("id","ID hoi thoai")], responses: { 200: ok("Marked as read successfully") } } };

p["/api/inventory/suppliers"] = {
  get: { tags: ["Inventory"], summary: "List suppliers", security: bearer, responses: { 200: ok("Supplier list") } },
  post: { tags: ["Inventory"], summary: "Create supplier", security: bearer, requestBody: json(ref("SupplierRequest")), responses: { 201: ok("Supplier created") } }
};
p["/api/inventory/suppliers/{id}"] = {
  get: { tags: ["Inventory"], summary: "Supplier details", security: bearer, parameters: [pid("id","ID nha cung cap")], responses: { 200: ok("Supplier details") } },
  put: { tags: ["Inventory"], summary: "Update supplier", security: bearer, parameters: [pid("id","ID nha cung cap")], requestBody: json(ref("SupplierRequest")), responses: { 200: ok("Supplier updated") } },
  delete: { tags: ["Inventory"], summary: "Delete supplier", security: bearer, parameters: [pid("id","ID nha cung cap")], responses: { 200: ok("Supplier deleted") } }
};
p["/api/inventory/documents"] = {
  get: { tags: ["Inventory"], summary: "List inventory documents", security: bearer, responses: { 200: ok("Inventory documents") } },
  post: { tags: ["Inventory"], summary: "Create inventory document", security: bearer, requestBody: json(ref("InventoryDocumentRequest")), responses: { 201: ok("Inventory document created") } }
};
p["/api/inventory/documents/{id}"] = { get: { tags: ["Inventory"], summary: "Inventory document details", security: bearer, parameters: [pid("id","ID phieu kho")], responses: { 200: ok("Inventory document details") } } };
p["/api/inventory/documents/{id}/complete"] = { post: { tags: ["Inventory"], summary: "Complete inventory document", security: bearer, parameters: [pid("id","ID phieu kho")], responses: { 200: ok("Inventory document completed") } } };
p["/api/inventory/documents/{id}/cancel"] = { post: { tags: ["Inventory"], summary: "Cancel inventory document", security: bearer, parameters: [pid("id","ID phieu kho")], responses: { 200: ok("Inventory document cancelled") } } };
p["/api/inventory/transactions"] = { get: { tags: ["Inventory"], summary: "List stock movements", security: bearer, responses: { 200: ok("Inventory transactions") } } };
p["/payments/checkout/{token}"] = { get: { tags: ["Payments"], summary: "Open mock checkout page", parameters: [tokenParam], responses: { 200: { description: "Payment HTML page" } } } };
p["/payments/{token}"] = { get: { tags: ["Payments"], summary: "Get payment session by token", parameters: [tokenParam], responses: { 200: ok("Payment session details") } } };
p["/payments/{token}/confirm"] = { post: { tags: ["Payments"], summary: "Confirm online payment", parameters: [tokenParam], responses: { 200: ok("Payment successful") } } };
p["/payments/{token}/cancel"] = { post: { tags: ["Payments"], summary: "Cancel online payment session", parameters: [tokenParam], responses: { 200: ok("Payment session cancelled successfully") } } };

module.exports = swaggerJSDoc({ definition: spec, apis: [] });




