import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'sitepack-react'


Site.propTypes = {
  env: PropTypes.object.isRequired,
  page: PropTypes.object.isRequired,
  children: PropTypes.node,
}
export default function Site({ env, page, children }) {
  return (
    <div>
      <nav>
        <Link env={env} href='/'>Sitepack</Link>
      </nav>
      <hr />
      <div className='body'>{children || <div className='404'>404</div>}</div>
    </div>
  )
}
