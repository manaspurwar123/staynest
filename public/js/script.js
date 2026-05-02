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
