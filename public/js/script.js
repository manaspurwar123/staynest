// Example starter JavaScript for disabling form submissions if there are invalid fields
(() => {
  'use strict'

  // Fetch all the forms we want to apply custom Bootstrap validation styles to
  const forms = document.querySelectorAll('.needs-validation')

  // Loop over them and prevent submission
  Array.from(forms).forEach(form => {
    form.addEventListener('submit', event => {
      if (!form.checkValidity()) {
        event.preventDefault()
        event.stopPropagation()
      }

      form.classList.add('was-validated')
    }, false)
  })
})()

document.querySelectorAll('[data-auth-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    const tabButton = document.getElementById(button.dataset.authTab)
    if (tabButton && window.bootstrap) {
      window.bootstrap.Tab.getOrCreateInstance(tabButton).show()
    }
  })
})

document.querySelectorAll('.js-managed-image').forEach((image) => {
  const shell = image.closest('.image-shell')

  const markLoaded = () => {
    if (shell) shell.classList.remove('is-loading')
    image.classList.add('is-loaded')
  }

  const useFallback = () => {
    const fallback = image.dataset.fallbackSrc
    if (fallback && image.src !== new URL(fallback, window.location.origin).href) {
      image.src = fallback
      return
    }
    markLoaded()
  }

  image.addEventListener('load', markLoaded, { once: false })
  image.addEventListener('error', useFallback, { once: false })

  if (image.complete && image.naturalWidth > 0) {
    markLoaded()
  }
})
