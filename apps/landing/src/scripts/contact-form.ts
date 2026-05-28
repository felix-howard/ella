document.querySelectorAll("form[data-contact-form]").forEach((form) => {
  if (!(form instanceof HTMLFormElement) || form.dataset.contactBound === "true") {
    return;
  }
  form.dataset.contactBound = "true";

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const contactEmail = form.dataset.contactEmail || "contact@ella.tax";
    const formspreeEndpoint = form.dataset.formspreeEndpoint || "";
    const submitHref = form.dataset.submitHref || "";
    const status = form.querySelector<HTMLElement>("[data-contact-status]");
    const data = new FormData(form);

    const showStatus = (message: string, tone: "success" | "error") => {
      if (!status) return;
      status.textContent = message;
      status.classList.remove(
        "hidden",
        "bg-primary-50",
        "text-primary-900",
        "ring-primary-100",
        "bg-error-100",
        "text-red-800",
        "ring-red-200",
      );
      if (tone === "success") {
        status.classList.add("bg-primary-50", "text-primary-900", "ring-1", "ring-primary-100");
      } else {
        status.classList.add("bg-error-100", "text-red-800", "ring-1", "ring-red-200");
      }
    };

    if (submitHref) {
      window.location.href = submitHref;
      return;
    }

    const body = [
      `Name: ${data.get("name") || ""}`,
      `Email: ${data.get("email") || ""}`,
      `Phone: ${data.get("phone") || ""}`,
      `Client Type: ${data.get("clientType") || ""}`,
      `Service Needed: ${data.get("service") || ""}`,
      "",
      `Message: ${data.get("message") || ""}`,
    ].join("\n");
    const mailtoHref = `mailto:${contactEmail}?subject=${encodeURIComponent("Ella Tax Services inquiry")}&body=${encodeURIComponent(body)}`;

    if (formspreeEndpoint) {
      fetch(formspreeEndpoint, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      })
        .then((response) => {
          if (!response.ok) throw new Error("Inquiry submit failed");
          form.reset();
          showStatus("Inquiry sent. Ella Tax Services will follow up.", "success");
        })
        .catch(() => {
          showStatus("Online submit failed. Opening email fallback.", "error");
          window.location.href = mailtoHref;
        });
      return;
    }

    if (mailtoHref.length > 1800) {
      showStatus(`Please shorten the message or email ${contactEmail} directly.`, "error");
      return;
    }

    window.location.href = mailtoHref;
  });
});
