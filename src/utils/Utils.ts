
export function divUp (a: number, b:number) {
    return Math.ceil(a/b)
}

export function nextPowerOf2(n:number)
{
    let count = 0
     
    if (n && !(n & (n - 1)))
        return n;
     
    while( n != 0)
    {
        n >>= 1;
        count += 1;
    }
     
    return 1 << count;
}