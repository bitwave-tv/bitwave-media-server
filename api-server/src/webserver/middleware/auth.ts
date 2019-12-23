import * as admin from 'firebase-admin';
import { check, validationResult  } from 'express-validator';
import { Request } from 'express';

type reqWithToken = Request & { token: string };

export const extractToken = ( req, res, next ) => {
  const getToken = ( req: Request ) => {
    console.log( 'extracting auth token' );
    if ( req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer' )
      return req.headers.authorization.split(' ')[1];
    else if ( req.query && req.query.token )
      return req.query.token;
    return null;
  };
  const token = getToken( req );
  ( req as reqWithToken ).token = token;
  req.body.token = token;
  next();
};

export const validateUserToken = () => {
  console.log( 'validate body' );

  return [
    check('user').isString(),
    check('token').isJWT(),
  ]
};

export const validate = ( req, res, next ) => {
  console.log( 'validate' );

  const errors = validationResult( req );

  if ( errors.isEmpty() ) return next();

  console.log( 'error validating' );

  const extractedErrors = [];
  errors
    .array()
      .map( err =>
        extractedErrors.push(
          {
            [err.param]: err.msg,
            type: typeof  err.value,
            valu: err.value,
          }
        )
      );

  return res
    .status(422)
    .json({
      errors: extractedErrors,
    });
};


/**
 * Returns user profile data for a given uid
 * @param uid
 */
const getUserData = async ( uid: string ): Promise<FirebaseFirestore.DocumentData> => {
  const userDocument = await admin.firestore()
    .collection( 'users' )
    .doc( uid )
    .get();
  return userDocument.data();
};

/**
 * Verifies user token & checks if user is admin
 * @param {FirebaseFirestore.DocumentData} data
 * @return {Promise<boolean>}
 */
const verifyAdmin = ( data: FirebaseFirestore.DocumentData ): boolean => {
  // Check if user has admin role
  return data.hasOwnProperty( 'role' )
    ? data.role === 'admin'
    : false;
};

/**
 * Verifies user token matches username
 * @param {FirebaseFirestore.DocumentData} data
 * @param {string} username
 * @return {Promise<boolean>}
 */
const verifyUser = ( data: FirebaseFirestore.DocumentData, username: string ): boolean => {
  // Check if username matches
  return data.hasOwnProperty( '_username' )
    ? data._username === username.toLowerCase()
    : false;
};

/**
 * Checks token and verifies user matches username or that they are an admin
 * @param {string} token
 * @param {string} username
 */
const verifyToken = async ( token: string, username: string ): Promise<boolean> => {
  // Require token
  if ( !token ) return false;

  // Verify token and get UID
  const { uid } = await admin.auth().verifyIdToken( token );

  // Get user data
  const data = await getUserData( uid );

  // Check if username matches token
  if ( verifyUser( data, username ) ) return true;

  // Check if user is an admin
  if ( verifyAdmin( data ) ) return true;

// User was not verified, and is not an admin
  console.log( 'Token verification failed' );

  return false;
};

export const authenticatedRequest = async ( req, res, next ) => {
  console.log( 'authenticating' );

  const token = req.body.token;
  const user  = req.body.user;

  const authenticated = await verifyToken(token, user);
  if ( authenticated ) {
    return next();
  }

  return res
    .status(403)
    .send({
      errors: [{
        location: 'Authentication',
        message: 'Authentication check failed',
      }],
    });
};
