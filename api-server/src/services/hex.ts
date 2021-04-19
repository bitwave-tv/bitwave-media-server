// Created by xander on 3/19/2021

export function toHex ( data ): string {
  // utf8 to latin1
  let s = unescape( encodeURIComponent( data ) );
  let result = '';
  for ( let i = 0; i < s.length; i++ ) {
    result += s.charCodeAt( i ).toString( 16 ).padStart( 2, '0' );;
  }
  return result;
}

export function fromHex ( hexData: string ): string {
  let result = '';
  for ( let i = 0; i < hexData.length; i+=2 ) {
    result += String.fromCharCode(
      parseInt( hexData.substr( i, 2 ), 16 )
    );
  }
  return decodeURIComponent( escape( result ) );
}
